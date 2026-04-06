import React from 'react';
import { createPortal } from 'react-dom';
import { Search, Bell, LogOut, Sun, Moon, Menu, Clock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';
import { notificationService } from '../services/notificationService';

const Header = ({
    onMenuClick,
    searchTerm,
    onSearchChange,
    hideSearch = false,
}) => {
    const { isDark, toggleTheme } = useTheme();
    const { logout, user } = useAuth();

    const [showNotifications, setShowNotifications] = React.useState(false);
    const [notifications, setNotifications] = React.useState([]);
    const [dropdownPos, setDropdownPos] = React.useState({ top: 72, right: 16 });
    const bellRef = React.useRef(null);
    const deniedWarnedRef = React.useRef(false);

    const placeDropdown = React.useCallback(() => {
        const el = bellRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setDropdownPos({
            top: r.bottom + 8,
            right: Math.max(12, window.innerWidth - r.right),
        });
    }, []);

    React.useEffect(() => {
        if (!user) return;

        notificationService.cleanupOldNotifications(user.id);
        notificationService.cleanupOldTokens(user.id);

        notificationService.syncPushForUser(user.id).catch(console.error);

        const fetchNotifs = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching notifications:', error);
                return;
            }
            if (data) setNotifications(data);
        };

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                notificationService.syncPushForUser(user.id).catch(() => {});
                fetchNotifs();
            }
        };
        document.addEventListener('visibilitychange', onVisible);

        fetchNotifs();

        const channelName = `header_notifs_${user.id}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotif = payload.new;
                    notificationService.showLocalNotification(newNotif.title, newNotif.message);
                    setNotifications((prev) => {
                        const exists = prev.some((n) => n.id === newNotif.id);
                        if (exists) return prev;
                        return [newNotif, ...prev].slice(0, 10);
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const updated = payload.new;
                    setNotifications((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const deletedId = payload.old?.id;
                    if (!deletedId) return;
                    setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    fetchNotifs();
                }
            });

        // Polling de respaldo para casos donde el canal realtime se corta silenciosamente.
        const pollId = window.setInterval(() => {
            fetchNotifs();
        }, 30000);

        let unsubscribeFirebase = () => {};
        import('../lib/firebaseClient').then(({ onMessageListener }) => {
            unsubscribeFirebase = onMessageListener((payload) => {
                const title = payload.notification?.title || 'Nuevo aviso';
                const body = payload.notification?.body || '';
                notificationService.showLocalNotification(title, body);
                setNotifications((prev) => {
                    const exists = prev.some((n) => n.title === title && n.message === body);
                    if (exists) return prev;
                    return [
                        {
                            id: Math.random(),
                            title,
                            message: body,
                            is_read: false,
                            created_at: new Date().toISOString(),
                        },
                        ...prev,
                    ].slice(0, 10);
                });
            });
        });

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.clearInterval(pollId);
            supabase.removeChannel(channel);
            if (unsubscribeFirebase) unsubscribeFirebase();
        };
    }, [user]);

    React.useEffect(() => {
        if (!showNotifications) return;
        placeDropdown();
        const onResize = () => placeDropdown();
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, true);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onResize, true);
        };
    }, [showNotifications, placeDropdown]);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const handleOpenNotifications = async () => {
        if (user?.id) {
            const permission = await notificationService.requestPermission(user.id);
            if (permission === 'denied' && !deniedWarnedRef.current) {
                deniedWarnedRef.current = true;
                alert('Las notificaciones del navegador están bloqueadas. Actívalas en la configuración del sitio para recibir alertas en tiempo real.');
            }
        }

        const willOpen = !showNotifications;
        if (willOpen) placeDropdown();
        setShowNotifications(willOpen);

        if (willOpen && unreadCount > 0) {
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .then(({ error }) => {
                    if (error) console.error('Error marking notifications read:', error);
                });
        }
    };

    const notificationPanel =
        showNotifications &&
        createPortal(
            <>
                <button
                    type="button"
                    aria-label="Cerrar notificaciones"
                    className="fixed inset-0 z-[380] bg-slate-900/20 dark:bg-black/40 cursor-default"
                    onClick={() => setShowNotifications(false)}
                />
                <div
                    className="fixed z-[390] w-[min(calc(100vw-1.5rem),24rem)] max-h-[min(80vh,28rem)] flex flex-col rounded-[1.75rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                >
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center shrink-0">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                                Centro de Alertas
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                    Notificaciones
                                </span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full">
                                    {notifications.length}
                                </span>
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-500/15 px-2 py-1 rounded-lg">
                                Nuevas
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain py-2 min-h-0">
                        {notifications.length === 0 ? (
                            <div className="p-10 text-center flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                                    <Bell size={22} />
                                </div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Sin notificaciones pendientes
                                </p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`mx-2 p-4 mb-1 rounded-2xl transition-colors cursor-default ${
                                        !n.is_read
                                            ? 'bg-blue-50 dark:bg-blue-500/10'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                    }`}
                                >
                                    <div className="flex gap-3">
                                        <div
                                            className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                                !n.is_read
                                                    ? 'bg-blue-500 animate-pulse'
                                                    : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 font-medium leading-relaxed">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Clock size={10} className="text-slate-400" />
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                    {new Date(n.created_at).toLocaleDateString(undefined, {
                                                        day: 'numeric',
                                                        month: 'short',
                                                    })}{' '}
                                                    •{' '}
                                                    {new Date(n.created_at).toLocaleTimeString(undefined, {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Solo últimas 10 · Limpieza +24h
                        </span>
                    </div>
                </div>
            </>,
            document.body
        );

    return (
        <div className="sticky top-0 z-[100] shrink-0 w-full isolate">
            <header className="h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-8 flex items-center justify-between shadow-sm transition-all duration-300">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all mr-2 shrink-0"
                    aria-label="Abrir menú"
                >
                    <Menu size={22} />
                </button>

                {!hideSearch ? (
                    <div className="flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl w-full max-w-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                        <Search size={18} className="group-focus-within:text-blue-500 transition-colors shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar tickets, equipos, reportes..."
                            value={searchTerm || ''}
                            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                        />
                    </div>
                ) : (
                    <div className="flex-1" />
                )}

                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all duration-300 active:scale-90"
                        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {isDark ? (
                            <Sun size={22} className="animate-in spin-in-90 duration-500" />
                        ) : (
                            <Moon size={22} className="animate-in spin-in-90 duration-500" />
                        )}
                    </button>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                    <div ref={bellRef} className="relative">
                        <button
                            type="button"
                            className={`relative p-2.5 rounded-xl transition-all ${
                                showNotifications
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'
                                    : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            onClick={handleOpenNotifications}
                            aria-expanded={showNotifications}
                            aria-haspopup="true"
                        >
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                            )}
                        </button>
                    </div>

                    {notificationPanel}

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

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
