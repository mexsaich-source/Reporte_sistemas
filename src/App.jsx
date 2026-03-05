import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// IMPORTANTE: Solo importamos useAuth, porque AuthProvider ya está en main.jsx
import { useAuth } from './context/AuthContext';

// Importamos tus vistas principales
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserPortal from './components/UserPortal';

// --- CADENERO 1: PROTECCIÓN PARA ADMIN / TECH ---
const ProtectedAdminRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

  // DEBUG LOG
  console.log("DEBUG [AdminRoute]:", { user: user?.email, role: profile?.role, loading });

  // 1. Mientras Supabase responde, mostramos un loader
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Si no hay sesión, lo pateamos al Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // NUEVO: Si hay usuario pero no se pudo cargar el perfil
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error de Perfil</h2>
          <p className="text-slate-600 mb-4">No se encontró tu información en la tabla 'profiles'. Contacta al administrador para sincronizar tu cuenta.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Reintentar</button>
        </div>
      </div>
    );
  }

  // 3. Si el rol NO es admin y NO es tech, lo mandamos al portal de usuarios normales
  const role = profile?.role?.toLowerCase();
  if (role !== 'admin' && role !== 'tech') {
    return <Navigate to="/portal" replace />;
  }

  // 4. Si pasó todas las pruebas, lo dejamos pasar al Dashboard
  return children;
};

// --- CADENERO 2: PROTECCIÓN PARA USUARIOS NORMALES ---
const ProtectedUserRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

  // DEBUG LOG
  console.log("DEBUG [UserRoute]:", { user: user?.email, role: profile?.role, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si un admin intenta entrar a la vista de usuario por la URL, lo regresamos a su Dashboard
  const role = profile?.role?.toLowerCase();
  if (role === 'admin' || role === 'tech') {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

// --- APLICACIÓN PRINCIPAL ---
function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Ruta protegida de Usuario Normal */}
        <Route
          path="/portal"
          element={
            <ProtectedUserRoute>
              <UserPortal />
            </ProtectedUserRoute>
          }
        />

        {/* Ruta protegida de Administrador / Técnico */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          }
        />

        {/* Redirecciones por defecto */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;