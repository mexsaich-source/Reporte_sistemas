import React from 'react';
import { MonitorSmartphone } from 'lucide-react';

const InventoryView = () => (
    <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm text-center">
        <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MonitorSmartphone size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Inventario de Dispositivos</h2>
        <p className="text-slate-500">Esta sección está en desarrollo. Aquí podrás ver y gestionar todos los equipos.</p>
    </div>
);

export default InventoryView;
