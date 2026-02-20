import React from 'react';
import { Users } from 'lucide-react';

const UsersView = () => (
    <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm text-center">
        <div className="bg-purple-100 text-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Gestión de Usuarios</h2>
        <p className="text-slate-500">Esta sección está en desarrollo. Administra técnicos y usuarios del sistema.</p>
    </div>
);

export default UsersView;
