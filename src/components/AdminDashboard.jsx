import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import StatCard from './StatCard';
import ChartSection from './ChartSection';
import TicketsModule from './TicketsModule';
import InventoryView from './Inventory';
import ActivitiesView from './Activities';
import ReportsView from './Reports';
import UsersView from './UsersList';
import { statsData } from '../data/mockData';

const AdminDashboard = ({ onLogout }) => {
    const [currentView, setCurrentView] = useState('Dashboard');
    const [activeTab, setActiveTab] = useState('Overview');

    const renderView = () => {
        switch (currentView) {
            case 'Tickets':
                return <TicketsModule />;
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {statsData.map((stat) => (
                                <StatCard key={stat.id} {...stat} />
                            ))}
                        </div>
                        <ChartSection />
                        <TicketsModule />
                    </>
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f3f4f6] text-slate-800 font-sans selection:bg-blue-500/30">
            <Sidebar activeItem={currentView} onSelectItem={setCurrentView} />

            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <Header userRole="admin" onLogout={onLogout} />

                <main className="p-8 lg:p-10 max-w-7xl mx-auto w-full">
                    <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                {currentView === 'Dashboard' ? 'Operaciones IT' : currentView}
                            </h1>
                            <p className="text-slate-500 mt-1 font-medium text-sm">
                                {currentView === 'Dashboard' ? 'Resumen general del estado de la infraestructura.' : `Gestionando la sección de ${currentView}.`}
                            </p>
                        </div>

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

export default AdminDashboard;
