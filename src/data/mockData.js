import {
    AlertCircle,
    Clock,
    CheckCircle,
    MonitorSmartphone,
} from 'lucide-react';

export const statsData = [
    { id: 1, label: 'Open Tickets', value: '41', trend: '+5%', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 2, label: 'Pending Activities', value: '28', trend: '-2%', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 3, label: 'Resolved This Week', value: '135', trend: '+12%', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 4, label: 'Devices Down', value: '18', trend: '-1', icon: MonitorSmartphone, color: 'text-red-600', bg: 'bg-red-100' },
];

export const ticketsByDepartment = [
    { name: 'TI', tickets: 45 },
    { name: 'Ventas', tickets: 32 },
    { name: 'RH', tickets: 15 },
    { name: 'Finanzas', tickets: 10 },
    { name: 'Operaciones', tickets: 22 },
];

export const failingDevices = [
    { name: 'Monitores', value: 55 },
    { name: 'Workstations', value: 40 },
    { name: 'Impresoras', value: 25 },
    { name: 'Laptops', value: 22 },
    { name: 'Docking Stations', value: 15 },
    { name: 'Otros', value: 4 },
];

export const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

export const recentTickets = [
    { id: 'TKT-1042', reportedBy: 'Ana Silva (RH)', issue: 'Laptop won\'t turn on', tech: 'Carlos M.', status: 'Open', date: 'Oct 24, 2023' },
    { id: 'TKT-1043', reportedBy: 'Luis Gomez (Ventas)', issue: 'Cannot print to Floor 3', tech: 'Unassigned', status: 'Open', date: 'Oct 24, 2023' },
    { id: 'TKT-1041', reportedBy: 'Maria Paz (Finanzas)', issue: 'ERP Login Error', tech: 'Elena R.', status: 'Pending', date: 'Oct 23, 2023' },
    { id: 'TKT-1039', reportedBy: 'Jose Ruiz (TI)', issue: 'Switch port configuration', tech: 'Carlos M.', status: 'Resolved', date: 'Oct 22, 2023' },
    { id: 'TKT-1038', reportedBy: 'Sofia Luna (Ventas)', issue: 'Request new monitor', tech: 'Elena R.', status: 'Resolved', date: 'Oct 22, 2023' },
];
