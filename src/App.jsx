import React, { useState } from 'react';

// --- MAIN PORTALS ---
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserPortal from './components/UserPortal';

const DashboardApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'user'

  const handleLogin = (role) => {
    setUserRole(role);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // If user is not admin, show User Portal
  if (userRole === 'user') {
    return <UserPortal onLogout={handleLogout} />;
  }

  // Otherwise show Admin Dashboard
  return <AdminDashboard onLogout={handleLogout} />;
};

export default DashboardApp;
