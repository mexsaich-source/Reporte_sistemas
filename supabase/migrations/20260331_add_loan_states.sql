-- ============================================================================
-- MIGRACIÓN: Agregar estados de préstamo a general_requests
-- ============================================================================
-- Descripción:
-- - Expande CHECK constraint de status en general_requests
-- - Agrega estados: borrowed, returned, overdue
-- - Mantiene compatibilidad con estados existentes: pending, approved, rejected, delivered
-- Este script es IDEMPOTENTE y tolerante a fallos

-- ============================================================================
-- PASO 1: Eliminar constraint anterior (si existe)
-- ============================================================================
ALTER TABLE public.general_requests 
DROP CONSTRAINT IF EXISTS general_requests_status_check;

-- ============================================================================
-- PASO 2: Agregar nuevo constraint con todos los estados permitidos
-- ============================================================================
ALTER TABLE public.general_requests 
ADD CONSTRAINT general_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'delivered', 'borrowed', 'returned', 'overdue'));

-- ============================================================================
-- PASO 3: Agregar índice para mejor performance en búsquedas por estado
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_general_requests_status ON public.general_requests(status);

-- ============================================================================
-- PASO 4: Crear índice compuesto para búsquedas user + status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_general_requests_user_status ON public.general_requests(user_id, status);

-- ============================================================================
-- PASO 5: Agregar índice para búsquedas de préstamos con fecha límite
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_general_requests_loan_end_date ON public.general_requests(loan_end_date) 
WHERE loan_end_date IS NOT NULL;
