import React, { useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  MonitorSmartphone,
  Activity,
  FileText,
  Users,
  Plus,
  Search,
  Bell,
  AlertCircle,
  Clock,
  CheckCircle,
  Laptop
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// --- MOCK DATA ---
const statsData = [
  { id: 1, label: 'Open Tickets', value: '41', trend: '+5%', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
  { id: 2, label: 'Pending Activities', value: '28', trend: '-2%', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  { id: 3, label: 'Resolved This Week', value: '135', trend: '+12%', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { id: 4, label: 'Devices Down', value: '18', trend: '-1', icon: MonitorSmartphone, color: 'text-red-600', bg: 'bg-red-100' },
];

const ticketsByDepartment = [
  { name: 'TI', tickets: 45 },
  { name: 'Ventas', tickets: 32 },
  { name: 'RH', tickets: 15 },
  { name: 'Finanzas', tickets: 10 },
  { name: 'Operaciones', tickets: 22 },
];

const failingDevices = [
  { name: 'Laptops', value: 45 },
  { name: 'Printers', value: 25 },
  { name: 'Desktops', value: 15 },
  { name: 'Network Eq.', value: 15 },
];

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

const recentTickets = [
  { id: 'TKT-1042', reportedBy: 'Ana Silva (RH)', issue: 'Laptop won\'t turn on', tech: 'Carlos M.', status: 'Open', date: 'Oct 24, 2023' },
  { id: 'TKT-1043', reportedBy: 'Luis Gomez (Ventas)', issue: 'Cannot print to Floor 3', tech: 'Unassigned', status: 'Open', date: 'Oct 24, 2023' },
  { id: 'TKT-1041', reportedBy: 'Maria Paz (Finanzas)', issue: 'ERP Login Error', tech: 'Elena R.', status: 'Pending', date: 'Oct 23, 2023' },
  { id: 'TKT-1039', reportedBy: 'Jose Ruiz (TI)', issue: 'Switch port configuration', tech: 'Carlos M.', status: 'Resolved', date: 'Oct 22, 2023' },
  { id: 'TKT-1038', reportedBy: 'Sofia Luna (Ventas)', issue: 'Request new monitor', tech: 'Elena R.', status: 'Resolved', date: 'Oct 22, 2023' },
];


// --- SUB-COMPONENTS ---

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Tickets', icon: Ticket, active: false },
    { name: 'Inventory/Devices', icon: MonitorSmartphone, active: false },
    { name: 'Activities', icon: Activity, active: false },
    { name: 'Reports', icon: FileText, active: false },
    { name: 'Users', icon: Users, active: false },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col min-h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3 border-b border-slate-100">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Laptop size={24} />
        </div>
        <span className="font-bold text-xl text-slate-800">IT Support Desk</span>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2 relative">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Menu</div>
        {menuItems.map((item) => (
          <button
            key={item.name}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${item.active
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <item.icon size={18} className={item.active ? 'text-blue-600' : 'text-slate-400'} />
            {item.name}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200/60">
        <div className="flex items-center gap-3 px-2">
          <img
            src="https://ui-avatars.com/api/?name=Admin+User&background=eff6ff&color=1d4ed8"
            alt="Admin"
            className="w-10 h-10 rounded-full border border-slate-200"
          />
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-slate-800">Admin User</span>
            <span className="text-xs text-slate-500">System Administrator</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, trend, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-4">
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-lg ${bg} ${color}`}>
        <Icon size={24} />
      </div>
      <span className={`text-sm font-medium ${trend.startsWith('+') ? 'text-emerald-600' : trend.startsWith('-') ? 'text-red-500' : 'text-slate-500'}`}>
        {trend}
      </span>
    </div>
    <div>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
    </div>
  </div>
);

const ChartSection = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
    {/* Bar Chart */}
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800 mb-6">Tickets by Department</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ticketsByDepartment} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="tickets" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Donut Chart */}
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800 mb-6">Failing Device Types</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={failingDevices}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {failingDevices.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const TicketTable = () => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Open': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">Open</span>;
      case 'Pending': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 border border-amber-200">Pending</span>;
      case 'Resolved': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Resolved</span>;
      default: return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm mt-6 overflow-hidden">
      <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-800">Recent Ticket Activity</h3>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus size={16} />
          New Ticket
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium border-b border-slate-100 pl-6">Ticket ID</th>
              <th className="p-4 font-medium border-b border-slate-100">Reported By</th>
              <th className="p-4 font-medium border-b border-slate-100">Device/Issue</th>
              <th className="p-4 font-medium border-b border-slate-100">Tech Assigned</th>
              <th className="p-4 font-medium border-b border-slate-100">Status</th>
              <th className="p-4 font-medium border-b border-slate-100 pr-6">Date</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700 divide-y divide-slate-50">
            {recentTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-4 pl-6 font-medium text-blue-600">{ticket.id}</td>
                <td className="p-4">{ticket.reportedBy}</td>
                <td className="p-4">{ticket.issue}</td>
                <td className="p-4 flex items-center gap-2">
                  {ticket.tech !== 'Unassigned' ? (
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                      {ticket.tech.charAt(0)}
                    </div>
                  ) : null}
                  <span className={ticket.tech === 'Unassigned' ? 'text-slate-400 italic' : ''}>
                    {ticket.tech}
                  </span>
                </td>
                <td className="p-4">{getStatusBadge(ticket.status)}</td>
                <td className="p-4 pr-6 text-slate-500">{ticket.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT ---

const DashboardApp = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navigation / Global Search */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-3 py-2 rounded-lg w-96 border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search tickets, devices, users..."
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-8 max-w-7xl mx-auto w-full">

          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IT Operations Overview</h1>
            <p className="text-slate-500 mt-1">Welcome back. Here is your system status.</p>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-slate-200 mt-6">
              {['Overview', 'Ticket Queue', 'Technician Status'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>
                  )}
                </button>
              ))}
            </div>
          </div>

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

        </main>
      </div>
    </div>
  );
};

export default DashboardApp;
