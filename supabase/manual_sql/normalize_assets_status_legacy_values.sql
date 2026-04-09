-- Normaliza valores legacy de assets.status a los estados canónicos del sistema.
-- Regla de negocio: NO inferir estado por assigned_to.
-- Si un equipo compartido está "en uso" y no tiene assigned_to, se conserva como active.

begin;

-- 1) Diagnóstico rápido antes de actualizar
select
  coalesce(status::text, '<NULL>') as raw_status,
  count(*) as total
from public.assets
group by 1
order by total desc;

-- 2) Cálculo robusto del estado normalizado
--    - lower + trim
--    - elimina acentos comunes
--    - elimina separadores (espacios, guiones, underscore, slash, puntos)
with base as (
  select
    id,
    status,
    lower(trim(coalesce(status::text, ''))) as s0,
    regexp_replace(
      translate(lower(trim(coalesce(status::text, ''))), 'áéíóúüñ', 'aeiouun'),
      '[\s_\-\./]+',
      '',
      'g'
    ) as s_compact
  from public.assets
),
mapped as (
  select
    id,
    status,
    case
      when s0 = '' then 'available'

      -- Disponible / bodega
      when s0 in ('available','disponible','libre','stock','bodega') then 'available'
      when s_compact like 'dispon%' then 'available'

      -- En uso
      when s0 in ('active','activo','asignado','en uso','in_use') then 'active'
      when s_compact in ('enuso','inuse','active','activo','asignado') then 'active'

      -- Prestamo
      when s0 in ('loaned','prestado','prestamo','préstamo') then 'loaned'
      when s_compact in ('loaned','prestado','prestamo') then 'loaned'

      -- Pendiente
      when s0 in ('request_pending','pendiente','solicitado','en solicitud') then 'request_pending'
      when s_compact in ('requestpending','pendiente','solicitado','ensolicitud') then 'request_pending'

      -- Denegado
      when s0 in ('denied','rechazado','rechazada','negado') then 'denied'
      when s_compact in ('denied','rechazado','rechazada','negado') then 'denied'

      -- Baja
      when s0 in ('decommissioned','baja','retirado','descontinuado') then 'decommissioned'
      when s_compact in ('decommissioned','baja','retirado','descontinuado') then 'decommissioned'

      -- Fallback seguro
      else 'available'
    end as normalized_status
  from base
),
changes as (
  select
    id,
    coalesce(status::text, '<NULL>') as old_status,
    normalized_status as new_status
  from mapped
  where coalesce(status::text, '') is distinct from normalized_status
)
-- 3) Impacto del cambio (antes de aplicar)
select
  old_status,
  new_status,
  count(*) as rows_to_update
from changes
group by old_status, new_status
order by rows_to_update desc, old_status, new_status;

-- 4) Aplicar actualización
with base as (
  select
    id,
    status,
    lower(trim(coalesce(status::text, ''))) as s0,
    regexp_replace(
      translate(lower(trim(coalesce(status::text, ''))), 'áéíóúüñ', 'aeiouun'),
      '[\s_\-\./]+',
      '',
      'g'
    ) as s_compact
  from public.assets
),
mapped as (
  select
    id,
    status,
    case
      when s0 = '' then 'available'
      when s0 in ('available','disponible','libre','stock','bodega') then 'available'
      when s_compact like 'dispon%' then 'available'
      when s0 in ('active','activo','asignado','en uso','in_use') then 'active'
      when s_compact in ('enuso','inuse','active','activo','asignado') then 'active'
      when s0 in ('loaned','prestado','prestamo','préstamo') then 'loaned'
      when s_compact in ('loaned','prestado','prestamo') then 'loaned'
      when s0 in ('request_pending','pendiente','solicitado','en solicitud') then 'request_pending'
      when s_compact in ('requestpending','pendiente','solicitado','ensolicitud') then 'request_pending'
      when s0 in ('denied','rechazado','rechazada','negado') then 'denied'
      when s_compact in ('denied','rechazado','rechazada','negado') then 'denied'
      when s0 in ('decommissioned','baja','retirado','descontinuado') then 'decommissioned'
      when s_compact in ('decommissioned','baja','retirado','descontinuado') then 'decommissioned'
      else 'available'
    end as normalized_status
  from base
)
update public.assets a
set status = mapped.normalized_status::asset_status
from mapped
where a.id = mapped.id
  and coalesce(a.status::text, '') is distinct from mapped.normalized_status;

-- 5) Diagnóstico post-normalización
select
  status::text as normalized_status,
  count(*) as total
from public.assets
group by 1
order by total desc;

commit;
