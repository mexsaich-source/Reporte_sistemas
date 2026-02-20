import React from 'react';
import { Activity } from 'lucide-react';

const ActivitiesView = () => (
    <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm text-center">
        <div className="bg-amber-100 text-amber-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Actividades Pendientes</h2>
        <p className="text-slate-500">Esta sección está en desarrollo. Aquí verás el historial de cambios y actividades.</p>
    </div>
);

export default ActivitiesView;
