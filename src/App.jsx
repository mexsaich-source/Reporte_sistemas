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

  // 3. Si el rol NO es admin y NO es tech, lo mandamos al portal de usuarios normales
  if (profile?.role !== 'admin' && profile?.role !== 'tech') {
    return <Navigate to="/portal" replace />;
  }

  // 4. Si pasó todas las pruebas, lo dejamos pasar al Dashboard
  return children;
};

// --- CADENERO 2: PROTECCIÓN PARA USUARIOS NORMALES ---
const ProtectedUserRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();

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
  if (profile?.role === 'admin' || profile?.role === 'tech') {
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