# Email de Contraseñas via SMTP Configurado

## Resumen

Se ha implementado un sistema para que los emails de **creación de contraseña** (primer login) y **recuperación de contraseña** (cambio/reset) sean enviados usando el mismo **SMTP configurado en Configuración > Notificaciones del Área**, en lugar de usar los emails por defecto de Supabase Auth.

## Flujos Implementados

### 1. **Crear Usuario - Email de Setup (Primera Vez)**

Cuando un admin crea un nuevo usuario:

```
Admin crea usuario en "Usuarios" → Sistema invoca send-password-email 
→ Función Edge genera enlace válido desde Supabase Auth 
→ Email enviado via SMTP configurado del área 
→ Usuario recibe correo de bienvenida con botón "Configurar Contraseña"
```

**Archivo:** `src/services/userService.js` - método `register()`
**Cambio:** Reemplaza `supabase.auth.resetPasswordForEmail()` por `supabase.functions.invoke('send-password-email')`

---

### 2. **Recuperar Contraseña - Email de Reset**

Cuando un admin envía enlace de reset a otro usuario (pestaña Usuarios, botón de contraseña):

```
Admin hace click "Enviar enlace de contraseña" 
→ Sistema invoca send-password-email con type='password_reset'
→ Función Edge genera enlace válido 
→ Email enviado via SMTP configurado del área
→ Usuario recibe correo para restablecer contraseña
```

**Archivo:** `src/components/UsersList.jsx` - línea ~373
**Cambio:** Reemplaza `supabase.auth.resetPasswordForEmail()` por `supabase.functions.invoke('send-password-email')`

---

### 3. **Cambiar Contraseña - Dentro del Perfil (Cliente)**

Cuando un usuario autenticado cambia su contraseña desde su perfil:

```
Usuario logueado → Panel > Perfil → Cambiar contraseña
→ Usa supabase.auth.updateUser({ password })
→ ✅ Sin cambios (no requiere email de confirmación)
```

**Archivo:** `src/components/ResetPassword.jsx`
**Estado:** Sin cambios necesarios ✓

---

## Nueva Función Edge: `send-password-email`

### Ubicación
```
supabase/functions/send-password-email/
├── index.ts      (lógica principal)
├── deno.json     (configuración Deno)
└── .npmrc        (configuración npm Supabase)
```

### Características

✅ **Genera enlace válido** desde la API Admin de Supabase Auth
✅ **Usa SMTP del área** (IT o ING) configurado en Notificaciones
✅ **Fallback a SMTP central** si ING no tiene config propia
✅ **Soporta dos tipos** de emails:
   - `password_setup`: Primer login (bienvenida)
   - `password_reset`: Recuperación/cambio

### Parámetros

```json
{
  "email": "usuario@ejemplo.com",
  "user_id": "uuid-del-usuario",
  "email_type": "password_setup" | "password_reset",
  "full_name": "Nombre Completo (opcional)"
}
```

**Nota:** El `reset_link` NO se necesita pasar; la función lo genera internamente.

### Respuesta

```json
{
  "success": true,
  "message": "password_setup email sent successfully to usuario@ejemplo.com"
}
```

---

## Configuración Requerida

### En Supabase Dashboard → Notificación > Configuración del Área

Ambas áreas (IT e ING) deben tener SMTP configurado:

| Campo | Ejemplo |
|-------|---------|
| **Nombre del Área** | IT o ING |
| **Host SMTP** | smtp.gmail.com |
| **Puerto SMTP** | 587 o 465 |
| **Usuario SMTP** | tu-email@empresa.com |
| **Contraseña SMTP** | token-o-contraseña |
| **Nombre del Remitente** | IT Helpdesk Mexsa |

### Variables de Entorno Supabase (Fallback)

Si no está configurado en BD, usa variables de entorno:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tu-email@empresa.com
SMTP_PASS=token-o-contraseña
```

---

## Flujo Visual Completo

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN CREA USUARIO (Pestaña Usuarios)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
                 userService.register()
                            ↓
          ┌─────────────────────────────────┐
          │ 1. Crear en Supabase Auth       │
          │    (con password temporal)      │
          └─────────────────────────────────┘
                            ↓
          ┌─────────────────────────────────┐
          │ 2. Si sendPasswordSetupEmail    │
          │    Invocar send-password-email  │
          │    con type='password_setup'    │
          └─────────────────────────────────┘
                            ↓
       ┌──────────────────────────────────────────┐
       │  [Edge Function] send-password-email     │
       ├──────────────────────────────────────────┤
       │ 1. Obtener settings SMTP del área        │
       │    (IT o ING según departamento user)    │
       │ 2. Generar enlace reset via Supabase API │
       │    auth.admin.generateLink()             │
       │ 3. Enviar email con nodemailer           │
       │    (host, port, user, pass)              │
       │ 4. Retornar {success: true}              │
       └──────────────────────────────────────────┘
                            ↓
              ┌──────────────────────────┐
              │ Email enviado via SMTP   │
              │ Configurado en el área   │
              └──────────────────────────┘
                            ↓
         Usuario recibe correo con botón:
         "Configurar Contraseña"
                            ↓
         Click en botón → /reset-password#type=recovery
                            ↓
         Supabase Auth valida token automáticamente
                            ↓
         Usuario define su contraseña
```

---

## Cambios en Archivos Principales

### `src/services/userService.js`

**Antes:**
```javascript
const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${authBase}/reset-password`
});
```

**Después:**
```javascript
const { data: funcResult, error: funcError } = await supabase.functions.invoke('send-password-email', {
  body: {
    email,
    user_id: data.user?.id,
    email_type: 'password_setup',
    full_name: fullName
  }
});
```

### `src/components/UsersList.jsx` (Reset Password)

**Antes:**
```javascript
const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
  redirectTo: `${getAuthRedirectBase()}/reset-password`,
});
```

**Después:**
```javascript
const { data: funcResult, error: funcError } = await supabase.functions.invoke('send-password-email', {
  body: {
    email: user.email,
    user_id: user.id,
    email_type: 'password_reset',
    full_name: user.full_name
  }
});
```

---

## Ventajas

✅ **Email centralizado:** El mismo SMTP para notificaciones, tickets, y credenciales  
✅ **Más control:** Branding consistente en todos los emails  
✅ **Multi-área:** Cada área (IT/ING) puede tener su propio SMTP  
✅ **Fallback inteligente:** ING usa SMTP de IT si no tiene propio  
✅ **Seguridad:** Enlace generado por Supabase Auth (válido y con token real)  
✅ **HTML bonito:** Template profesional con el nombre del área  

---

## Prueba Rápida

1. Ve a **Admin → Usuarios**
2. Haz click en **"Agregar usuario"**
3. Completa el formulario y selecciona **"Sí, enviar email de contraseña"**
4. Usuario recibe correo desde el SMTP configurado (no desde Supabase)
5. Click en botón del email → Configura su contraseña
6. Login exitoso ✓

---

## Solución de Problemas

| Situación | Solución |
|-----------|----------|
| Email no se envía | Verifica SMTP configurado en Notificaciones del área |
| Enlace inválido | Supabase Auth admin RPC debe estar activo |
| Email llega vacío | Revisa HTML template en `send-password-email/index.ts` |
| User no existe | Verifica que se guardó en `profiles` tabla post-signUp |

---

## Roadmap Futuro (Opcional)

- [ ] Endpoint UI para probar envío de emails de contraseña
- [ ] Log de auditoría para password reset emails
- [ ] Personalización de template HTML por área
- [ ] Otp/SMS como alternativa a email para primer setup
- [ ] Queue de reintentos si SMTP falla

