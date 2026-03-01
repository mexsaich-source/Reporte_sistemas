import React from 'react';
import { useAuth } from './context/AuthContext';

// --- MAIN PORTALS ---
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserPortal from './components/UserPortal';

const DashboardApp = () => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // If user is admin or tech, show Admin Dashboard (we'll implement tech delegation view inside AdminDashboard as requested)
  if (profile?.role === 'admin' || profile?.role === 'tech') {
    return <AdminDashboard onLogout={logout} />;
  }

  // Otherwise, show User Portal
  return <UserPortal onLogout={logout} />;
};

export default DashboardApp;
