import React, { memo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// IMPORTANTE: Solo importamos useAuth de authStore
import { useAuth } from './context/authStore';

// Importamos tus vistas principales
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserPortal from './components/UserPortal';

/**
 * --- COMPONENTE DE ERROR COMPARTIDO ---
 */
const AuthErrorScreen = ({ error, logout }) => {
  const isTimeout = error === 'FETCH_TIMEOUT';
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center">
        <h2 className="text-xl font-bold text-red-600 mb-2">
          {isTimeout ? 'Error de Conexión' : 'Error de Perfil'}
        </h2>
        <p className="text-slate-600 mb-4">
          {isTimeout 
            ? 'La conexión está tardando más de lo habitual. Por favor, verifica tu internet o intenta de nuevo.' 
            : 'No se encontró tu perfil o hubo un problema al cargar los datos.'}
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Reintentar</button>
          <button onClick={logout} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-100">Cerrar Sesión</button>
        </div>
      </div>
    </div>
  );
};

// Loader centrado reutilizable
const FullPageLoader = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

/**
 * --- REDIRECCIÓN INTELIGENTE ---
 * El punto de entrada '/' decide a dónde enviar al usuario.
 */
const RootRedirect = () => {
  const { user, profile, loading, authError, logout } = useAuth();

  if (loading) return <FullPageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (!profile && !authError) return <FullPageLoader />;

  if (!profile && authError) {
    return <AuthErrorScreen error={authError} logout={logout} />;
  }

  // Redirección por rol
  const role = profile?.role?.toLowerCase() || '';
  if (role === 'admin' || role === 'tech' || role === 'técnico') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/portal" replace />;
};

/**
 * --- CADENERO PARA RUTAS PROTEGIDAS ---
 */
const ProtectedRoute = memo(({ children, allowedRoles = [] }) => {
  const { user, profile, loading, authError, logout } = useAuth();

  // 1. Cargando sesión inicial
  if (loading) return <FullPageLoader />;

  // 2. Sin sesión → Login
  if (!user) return <Navigate to="/login" replace />;

  // 3. Esperando perfil (si ya tenemos usuario pero el fetchProfile no termina)
  if (!profile && !authError) return <FullPageLoader />;

  // 4. Error real del perfil
  if (authError) return <AuthErrorScreen error={authError} logout={logout} />;

  // 5. Verificación de Rol
  const userRole = profile?.role?.toLowerCase() || '';
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    console.warn("Acceso denegado. Rol:", userRole, "Rutas permitidas:", allowedRoles);
    // IMPORTANTE: Solo redirigimos si NO estamos ya en la ruta destino
    // Para evitar bucles, si no tiene permiso aquí, lo mandamos al 'Root'
    // y que RootRedirect decida según su rol real.
    return <Navigate to="/" replace />;
  }

  return children;
});

// --- APLICACIÓN PRINCIPAL ---
function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<Login />} />

      {/* Portal de Usuarios Operativos */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['user', 'operativo', 'operador']}>
            <UserPortal />
          </ProtectedRoute>
        }
      />

      {/* Dashboard de Administradores / Técnicos */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin', 'tech', 'técnico']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Redirecciones por defecto */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
