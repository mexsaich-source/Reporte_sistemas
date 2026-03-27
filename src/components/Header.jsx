import React from 'react';
import { Search, Bell, LogOut, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';
import { notificationService } from '../services/notificationService';

const Header = ({ userName = "Usuario", userType = "Operativo", onMenuClick, searchTerm, onSearchChange }) => {
    const { isDark, toggleTheme } = useTheme();
    const { logout, user } = useAuth();
    
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [notifications, setNotifications] = React.useState([]);
    const [permissionStatus, setPermissionStatus] = React.useState(
        'Notification' in window ? Notification.permission : 'unsupported'
    );

    React.useEffect(() => {
        if (!user) return;

        // Auto clean old records & setup push
        notificationService.cleanupOldNotifications(user.id);
        
        // Intentar pedir permiso si no está definido
        if (Notification.permission === 'default') {
            notificationService.requestPermission().then(res => {
                console.log('Notification permission result:', res);
            });
        }

        const fetchNotifs = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) console.error('Error fetching initial notifications:', error);
            if (data) setNotifications(data);
        };
        fetchNotifs();
        
        // Supabase Real-time (Plan B respaldo)
        const channelName = `header_notifs_${user.id}`;
        const channel = supabase.channel(channelName)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${user.id}` 
            }, payload => {
                console.log('Nueva notificación recibida en tiempo real (Supabase):', payload.new);
                const newNotif = payload.new;
                setNotifications(prev => {
                    const exists = prev.some(n => n.id === newNotif.id);
                    if (exists) return prev;
                    return [newNotif, ...prev].slice(0, 10);
                });
                
                // Show native push notification when app is open (Supabase fallback)
                notificationService.showLocalNotification(newNotif.title, newNotif.message);
            })
            .subscribe((status) => {
                console.log(`Suscripción de notificaciones (${channelName}) estado:`, status);
            });

        // Firebase Foreground Push (Plan C Principal)
        import('../lib/firebaseClient').then(({ onMessageListener }) => {
            const startListening = () => {
                onMessageListener().then(payload => {
                    console.log('Push en primer plano (Firebase):', payload);
                    const title = payload.notification?.title || 'Nuevo aviso';
                    const body = payload.notification?.body || '';
                    
                    // Show local notification using standard API
                    notificationService.showLocalNotification(title, body);
                    
                    // Add purely visual notification item if it's not already from real-time
                    setNotifications(prev => {
                        const exists = prev.some(n => n.title === title && n.message === body);
                        if (exists) return prev;
                        const fakeId = Math.random();
                        return [{ id: fakeId, title, message: body, is_read: false, created_at: new Date().toISOString() }, ...prev].slice(0, 10);
                    });
                    
                    // Loop listener to catch next messages
                    startListening();
                }).catch(err => console.log('Error Firebase listener:', err));
            };
            startListening();
        });
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleOpenNotifications = () => {
        const willOpen = !showNotifications;
        setShowNotifications(willOpen);

        // Pedir permiso en el primer clic si aún no se ha decidido (sin bloquear UI)
        if (willOpen && Notification.permission === 'default') {
            notificationService.requestPermission(user.id).then(() => {
                 setPermissionStatus(Notification.permission);
            }).catch(console.error);
        }
        
        if (willOpen && unreadCount > 0) {
            // optimistically update read status
            setNotifications(prev => prev.map(n => ({...n, is_read: true})));
            
            // Background update
            supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .then(({error}) => {
                    if (error) console.error('Error marking notifications read:', error);
                });
        }
    };

    const requestPermissionManually = () => {
        notificationService.requestPermission(user.id).then(status => {
            setPermissionStatus(status);
            if (status === 'denied') {
                alert("Debes permitir las notificaciones manualmente desde los ajustes de tu navegador (el candadito en la barra de direcciones).");
            }
        });
    };

    return (
        <div className="sticky top-0 z-10 w-full">
            {/* Banner de Permisos de Notificación */}
            {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-medium">
                        <Bell size={16} />
                        <span>Activa las alertas del escritorio para recibir nuevos reportes al instante.</span>
                    </div>
                    <button 
                        onClick={requestPermissionManually}
                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold transition-colors"
                    >
                        {permissionStatus === 'denied' ? 'Revisar Permisos' : 'Habilitar ahora'}
                    </button>
                </div>
            )}
            
            <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-8 flex items-center justify-between shadow-sm transition-all duration-300">
                {/* Botón hamburguesa: solo visible en móvil */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all mr-2 shrink-0"
                    aria-label="Abrir menú"
                >
                    <Menu size={22} />
                </button>

                    <div className="flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl w-full max-w-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                        <Search size={18} className="group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar tickets, equipos, reportes..."
                            value={searchTerm || ''}
                            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                        />
                    </div>

                <div className="flex items-center gap-4 sm:gap-6">
                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all duration-300 active:scale-90"
                        title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                    >
                        {isDark ? <Sun size={22} className="animate-in spin-in-90 duration-500" /> : <Moon size={22} className="animate-in spin-in-90 duration-500" />}
                    </button>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

                    <div className="relative">
                        <button 
                            onClick={handleOpenNotifications}
                            className={`p-2.5 rounded-xl transition-all ${showNotifications ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Bell size={22} />
                            {unreadCount > 0 && <span className="absolute top-2.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>}
                        </button>
                        
                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Notificaciones</h4>
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">{notifications.length} recientes</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Sin notificaciones</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n.id} className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-2 font-medium">{new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                    <button
                        onClick={logout}
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all text-sm font-bold tracking-wide"
                    >
                        <LogOut size={18} />
                        <span className="hidden sm:inline">Salir</span>
                    </button>

                </div>
            </header>
        </div>
    );
};

export default Header;

