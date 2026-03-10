import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => {
    return useContext(AuthContext);
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    // --- CONFIGURACIÓN DE SEGURIDAD ---
    const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 minutos en milisegundos
    let inactivityTimer = null;

    useEffect(() => {
        let isMounted = true;
        console.log("DEBUG: AuthProvider mounted");

        // Safety timeout
        const safetyTimer = setTimeout(() => {
            if (isMounted) {
                console.warn("DEBUG: Safety timer triggered, setting loading to false");
                setLoading(false);
            }
        }, 5000);

        // Fetch current session
        const getSession = async () => {
            try {
                console.log("DEBUG: Calling getSession()");
                // Obtenemos la sesión con un catch para evitar el error de "Lock broken"
                const { data: { session }, error } = await supabase.auth.getSession().catch(err => {
                    console.error("DEBUG: getSession() catch block:", err);
                    if (err.message?.includes('Lock broken')) {
                        console.warn("DEBUG: Conflicto de bloqueo detectado, reintentando...");
                        return { data: { session: null }, error: null };
                    }
                    throw err;
                });

                console.log("DEBUG: getSession() result:", { sessionExists: !!session, error });

                if (error) throw error;

                if (session?.user && isMounted) {
                    console.log("DEBUG: getSession() found user, calling fetchProfile");
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (isMounted) {
                    console.log("DEBUG: getSession() found no user, setting loading false");
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error al obtener sesión en getSession:", err);
                if (isMounted) setLoading(false);
            } finally {
                console.log("DEBUG: getSession() finally block");
                if (isMounted) clearTimeout(safetyTimer);
            }
        };

        getSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("DEBUG: onAuthStateChange triggered with event:", event);
                // Evitamos activar "loading" estricto si el evento es meramente un refresco de token fallido que regresa INITIAL_SESSION
                if (session?.user && isMounted) {
                    console.log("DEBUG: onAuthStateChange user found, calling fetchProfile");
                    // OJO: Solo bloqueamos la UI si es explícitamente un logueo voluntario (SIGNED_IN)
                    if (event === 'SIGNED_IN') {
                        setLoading(true);
                    }
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (isMounted) {
                    console.log("DEBUG: onAuthStateChange no user found, clearing auth states");
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            console.log("DEBUG: AuthProvider unmounted");
            isMounted = false;
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
            stopInactivityTimer();
        };
    }, []);

    // --- LÓGICA DE INACTIVIDAD (60 MINUTOS) ---
    const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (user) {
            inactivityTimer = setTimeout(() => {
                console.warn("Sesión cerrada por inactividad");
                logout();
            }, INACTIVITY_LIMIT);
        }
    };

    const stopInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
    };

    useEffect(() => {
        if (user) {
            // Eventos que reinician el contador
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

            const handleActivity = () => resetInactivityTimer();

            events.forEach(event => {
                document.addEventListener(event, handleActivity);
            });

            resetInactivityTimer();

            return () => {
                events.forEach(event => {
                    document.removeEventListener(event, handleActivity);
                });
                stopInactivityTimer();
            };
        }
    }, [user]);

    // --- LÓGICA DE CIERRE FORZOSO (REALTIME) ---
    useEffect(() => {
        if (!user) return;

        // Escuchamos cambios en tiempo real en la tabla profiles para este usuario
        const profileSubscription = supabase
            .channel(`profile_changes_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    if (payload.new && payload.new.force_logout === true) {
                        console.error("Cierre forzoso detectado desde el servidor");
                        logout();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileSubscription);
        };
    }, [user]);

    const fetchProfile = async (userId) => {
        setAuthError(null);
        try {
            console.log("DEBUG: Iniciando consulta a tabla profiles para el usuario:", userId);
            
            // Timeout promise to avoid infinite hang on supabase fetch
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
            );

            // Actual fetch promise
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            console.log("DEBUG: Resultado de profiles:", { dataExists: !!data, error });

            if (error) {
                console.error("DEBUG: Perfil no encontrado para el usuario:", userId, error);
                setProfile(null);
                setAuthError('NO_PROFILE');
            } else if (data.force_logout === true) {
                console.warn("DEBUG: Sesión bloqueada administrativamente para el usuario:", userId);
                setProfile(data);
                setAuthError('BLOCKED');
                await logout(); // Expulsar inmediatamente si está bloqueado
            } else {
                setProfile(data);
                setAuthError(null);
            }
        } catch (err) {
            console.error("Error inesperado al cargar perfil (posible timeout):", err);
            setProfile(null);
            setAuthError('SYSTEM_ERROR');
        } finally {
            console.log("DEBUG: Saliendo de fetchProfile, cambiando loading a false");
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const register = async (email, password, fullName, role = 'user') => {
        // Enviamos la metadata para que el TRIGGER de SQL cree el perfil automáticamente
        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: role,
                    department: 'General'
                }
            }
        });
    };

    const logout = async () => {
        // Limpieza visual inmediata para independencia total
        setUser(null);
        setProfile(null);
        stopInactivityTimer();

        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error("Error al salir:", err);
        } finally {
            // BORRADO AGRESIVO: Esto garantiza que no queden rastros de la sesión anterior
            localStorage.clear();
            sessionStorage.clear();

            // Forzamos recarga a la raíz para asegurar que el sistema inicie limpio
            window.location.href = '/login';
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            login,
            register,
            logout,
            authError,
            setAuthError
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;