import React, { useState } from 'react';
import { Search, Bell, LogOut } from 'lucide-react';

// --- COMPONENTS ---
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import StatCard from './components/StatCard';
import ChartSection from './components/ChartSection';
import TicketTable from './components/TicketTable';

// --- NEW VIEWS ---
import TicketsView from './components/Tickets';
import InventoryView from './components/Inventory';
import ActivitiesView from './components/Activities';
import ReportsView from './components/Reports';
import UsersView from './components/UsersList';
import UserPortal from './components/UserPortal';

// --- DATA ---
import { statsData } from './data/mockData';

const DashboardApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'user'
  const [currentView, setCurrentView] = useState('Dashboard');
  const [activeTab, setActiveTab] = useState('Overview');

  const handleLogin = (role) => {
    setUserRole(role);
    setIsAuthenticated(true);
    setCurrentView('Dashboard');
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

  const renderView = () => {
    switch (currentView) {
      case 'Tickets':
        return <TicketsView />;
      case 'Inventory':
        return <InventoryView />;
      case 'Activities':
        return <ActivitiesView />;
      case 'Reports':
        return <ReportsView />;
      case 'Users':
        return <UsersView />;
      case 'Dashboard':
      default:
        return (
          <>
            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsData.map((stat) => (
                <StatCard key={stat.id} {...stat} />
              ))}
            </div>

            {/* Charts Row */}
            <ChartSection />

            {/* Data Table Row */}
            <TicketTable />
          </>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f3f4f6] text-slate-800 font-sans selection:bg-blue-500/30">
      {/* Sidebar */}
      <Sidebar activeItem={currentView} onSelectItem={setCurrentView} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top Navigation / Global Search */}
        <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 bg-white px-4 py-2.5 rounded-2xl w-96 border border-slate-200/60 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
            <Search size={18} className="group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar tickets, equipos, reportes..."
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400 font-medium"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all text-sm font-bold tracking-wide"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Header Section */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {currentView === 'Dashboard' ? 'Operaciones IT' : currentView}
              </h1>
              <p className="text-slate-500 mt-1 font-medium text-sm">
                {currentView === 'Dashboard' ? 'Resumen general del estado de la infraestructura.' : `Gestionando la sección de ${currentView}.`}
              </p>
            </div>

            {/* Tabs (Only visible on Dashboard for now) */}
            {currentView === 'Dashboard' && (
              <div className="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl">
                {['General', 'Cola de Tickets', 'Técnicos'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2 text-sm font-bold transition-all rounded-xl ${activeTab === tab
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>

          {renderView()}

        </main>
      </div>
    </div>
  );
};

export default DashboardApp;
