import React from 'react';
import TicketTable from './TicketTable';

const TicketsView = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Gestión de Tickets</h2>
        </div>
        <TicketTable />
    </div>
);

export default TicketsView;
