import React from 'react';
import { FileText } from 'lucide-react';

const ReportsView = () => (
    <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm text-center">
        <div className="bg-emerald-100 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Reportes del Sistema</h2>
        <p className="text-slate-500">Esta sección está en desarrollo. Podrás exportar métricas y análisis detallados.</p>
    </div>
);

export default ReportsView;
