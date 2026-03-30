# 🔔 Guía de Implementación: FCM Tokens Multi-Navegador

## 📋 Resumen de Cambios

Tu sistema ahora soporta **múltiples tokens por usuario** (uno por navegador/dispositivo) con detección automática de plataforma.

### ¿Qué se cambió?

| Aspecto | Antes | Ahora |
|--------|-------|-------|
| Tokens por usuario | 1 | ∞ (múltiples) |
| Campo platform | ❌ No | ✅ Sí (web/ios/android) |
| Soft-delete | ❌ No | ✅ Sí (is_active) |
| Actualización last_seen | Manual | ✅ Automática (con trigger) |
| Limpieza fallback | ❌ No | ✅ Sí (cleanup function) |

---

## 🚀 PASO 1: Ejecutar SQL en Supabase

1. Abre tu dashboard de **Supabase**
2. Ve a **SQL Editor** → **New Query**
3. Copia TODO el contenido de:
   ```
   supabase/migrations/20260330_fcm_tokens_improved.sql
   ```
4. Pega en el editor
5. **Run** (botón azul)

✅ Si no hay errores, tu tabla está lista.

---

## 🔧 PASO 2: Código Frontend (Ya implementado)

El archivo **notificationService.js** ya tiene:

### ✅ Nuevo método `detectPlatform()`
```javascript
// Detecta automáticamente: 'web', 'ios', 'android'
const platform = detectPlatform();
```

### ✅ Actualizado `setupFCMToken(userId)`
```javascript
const row = {
    user_id: userId,
    token: currentToken,
    device_info: deviceInfo,
    platform: platform,           // ← NUEVO
    is_active: true               // ← NUEVO
};

// Los campos created_at y last_seen_at se manejan en SQL
```

### ✅ Nuevo método `deactivateTokensForLogout()`
```javascript
// Llamar en logout para marcar tokens como inactivos
await notificationService.deactivateTokensForLogout();
```

### ✅ Nuevo método `getActiveTokensForUser(userId)`
```javascript
// Obtén todos los tokens activos para enviar notificaciones
const tokens = await notificationService.getActiveTokensForUser(userId);
```

### ✅ Mejorado `cleanupOldTokens(userId)`
```javascript
// Ahora elimina tokens inactivos > 90 días
```

---

## 📱 PASO 3: Integración con Login/Logout

### En tu componente de Login:
```javascript
import { notificationService } from './services/notificationService';

const { login, user } = useAuth();

const handleLogin = async (email, password) => {
    const { error } = await login(email, password);
    
    if (!error && user) {
        // Registra FCM después de login exitoso
        const result = await notificationService.syncPushForUser(user.id);
        console.log('Notificaciones sincronizadas:', result);
    }
};
```

### En tu componente de Logout:
```javascript
const handleLogout = async () => {
    // Marca tokens como inactivos ANTES de logout
    await notificationService.deactivateTokensForLogout();
    
    // Luego hace logout normal
    logout();
};
```

---

## 🧪 PASO 4: Prueba Rápida

### Test 1: Abre en 2 navegadores
1. Abre `http://localhost:5173` en **Chrome**
2. Abre `http://localhost:5173` en **Firefox**
3. Login en ambos
4. Ve a Supabase → Table: `fcm_tokens`
5. Deberías ver **2 filas** (misma user_id, diferentes tokens)

### Test 2: Verifica Platform
```javascript
// En la consola del navegador:
console.log(detectPlatform()); // → 'web'
```

### Test 3: Verifica Soft-Delete
```javascript
// Logout en uno de los navegadores, luego:
SELECT * FROM fcm_tokens WHERE user_id = '...';
-- Deberías ver is_active = false para ese token
```

---

## 🛠️ PASO 5: Llamar Cleanup (Mantenimiento)

Para limpiar tokens viejos, tienes 3 opciones:

### Opción A: Desde Client (en logout)
```javascript
// En notificationService.js ya existe
await notificationService.cleanupOldTokens(userId);
```

### Opción B: Desde SQL (manual)
```sql
-- En Supabase SQL Editor
SELECT * FROM public.cleanup_old_fcm_tokens();
-- Retorna: cuántos tokens se borraron
```

### Opción C: Cron automático (recomendado)
Crea una **Edge Function** en Supabase que ejecute el cleanup cada noche:

```javascript
// supabase/functions/cleanup-fcm/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { data, error } = await supabaseAdmin
    .rpc('cleanup_old_fcm_tokens');
  
  return new Response(
    JSON.stringify({ deleted: data?.[0]?.deleted_count || 0 })
  );
});
```

---

## 📊 PASO 6: Monitoreo (Dashboard Admin)

Para ver estadísticas de tokens:

```javascript
// En tu AdminDashboard o reportes
const { data: stats } = await supabase
    .rpc('get_fcm_tokens_stats');

console.log(stats);
// {
//   total_tokens: 45,
//   active_tokens: 32,
//   inactive_tokens: 13,
//   by_platform: { web: 30, ios: 10, android: 5 }
// }
```

O ver tokens activos con detalles:

```javascript
const { data: activeTokens } = await supabase
    .from('v_fcm_tokens_active')
    .select('*');
```

---

## 🎯 Checklist Final

- [ ] SQL ejecutado en Supabase (sin errores)
- [ ] notificationService.js actualizado ✅
- [ ] Login llama `syncPushForUser()` ✅
- [ ] Logout llama `deactivateTokensForLogout()` ✅
- [ ] Probado en 2 navegadores (deberían tener tokens separados)
- [ ] Verificado en Supabase que existen 2 filas para mismo user_id

---

## 🐛 Troubleshooting

**Problema:** No aparecen tokens en Supabase
> Revisa: ¿FCM está habilitado? ¿Notificaciones permitidas? ¿HTTPS activo?

**Problema:** Solo aparece 1 token aunque abra 2 navegadores
> El token FCM depende del navegador. Algunos navegadores comparten token. Usa navegadores diferentes (Chrome + Firefox).

**Problema:** `is_active` no se actualiza a `false` en logout
> Verifica que `deactivateTokensForLogout()` se ejecute SIN errores en consola.

**Problema:** Error al insertar (conflict)
> Revisa que el constraint `unique (user_id, token)` esté creado. Si no, elimina la tabla y corre el SQL de nuevo.

---

## 📚 Archivos Modificados

- ✅ `src/services/notificationService.js` - Completamente actualizado
- ✅ `supabase/migrations/20260330_fcm_tokens_improved.sql` - Nuevo archivo con toda la lógica SQL

---

## 🔐 Seguridad

La tabla tiene **Row Level Security (RLS)** habilitado:
- Usuarios solo ven sus propios tokens ✅
- Usuarios solo pueden insertar/actualizar sus tokens ✅
- Admins pueden hacer queries especiales (revisa RLS policies)

---

**¿Listo? ¡Vamos a hacerlo! 🚀**
