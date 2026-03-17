import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthContext } from './authStore';

/**
 * AuthProvider component that only handles the state management logic.
 * The context and hook are defined in authStore.js to prevent HMR errors.
 */
export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    const INACTIVITY_LIMIT = 60 * 60 * 1000; // 60 minutos
    const inactivityTimerRef = useRef(null);
    
    // Refs para tracking interno (Sincronización instantánea)
    const userRef = useRef(null);
    const profileRef = useRef(null);
    const isFetchingRef = useRef(false);
    const safetyTimerRef = useRef(null);

    // Sincronización de refs
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { profileRef.current = profile; }, [profile]);

    // --- FETCH PROFILE ---
    const fetchProfile = async (userId, isMounted = true) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        
        try {
            console.log('DEBUG: fetchProfile starting for', userId);
            
            // Creamos una promesa que falla tras 6 segundos (Timeout interno)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT_DB')), 6000)
            );

            // Promesa real de Supabase
            const queryPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Competencia entre la consulta y el timeout
            const result = await Promise.race([queryPromise, timeoutPromise]);
            
            if (!isMounted) return;

            const { data, error } = result;

            if (error) {
                console.error('DEBUG: Profile Query Error:', error.message);
                setAuthError('NO_PROFILE');
            } else if (data?.force_logout === true) {
                console.warn('DEBUG: Force logout active');
                setProfile(data);
                profileRef.current = data;
                setAuthError('BLOCKED');
                await logout();
            } else {
                console.log('DEBUG: Profile success');
                setProfile(data);
                profileRef.current = data;
                setAuthError(null);
            }
        } catch (err) {
            console.error('DEBUG: Fetch error or timeout:', err.message);
            if (isMounted) {
                if (err.message === 'TIMEOUT_DB') {
                    setAuthError('FETCH_TIMEOUT');
                } else {
                    setAuthError('SYSTEM_ERROR');
                }
            }
        } finally {
            isFetchingRef.current = false;
            if (isMounted) {
                console.log('DEBUG: Auth sequence end');
                setLoading(false);
            }
        }
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        let isMounted = true;
        console.log('DEBUG: AuthProvider mount');

        // Safety timer global (Cinturón de seguridad final)
        safetyTimerRef.current = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('DEBUG: Global safety timer triggered');
                if (userRef.current && !profileRef.current) {
                    setAuthError('FETCH_TIMEOUT');
                }
                setLoading(false);
            }
        }, 10000); // 10s total

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!isMounted) return;
                console.log('DEBUG: Auth Event →', event);

                const currentUser = session?.user || null;
                
                // Sincronización inmediata
                if (currentUser?.id !== userRef.current?.id) {
                    setUser(currentUser);
                    userRef.current = currentUser;
                }

                if (currentUser) {
                    if (!profileRef.current && !isFetchingRef.current) {
                        setLoading(true);
                        fetchProfile(currentUser.id, isMounted);
                    }
                } else {
                    setUser(null);
                    userRef.current = null;
                    setProfile(null);
                    profileRef.current = null;
                    setAuthError(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            subscription.unsubscribe();
        };
    }, []);

    // --- LOGOUT ---
    const logout = async () => {
        setUser(null);
        userRef.current = null;
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
        setAuthError(null);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('SignOut error:', e);
        } finally {
            window.location.href = '/login';
        }
    };

    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (userRef.current) {
            inactivityTimerRef.current = setTimeout(() => logout(), INACTIVITY_LIMIT);
        }
    };

    useEffect(() => {
        if (user) {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            const handleActivity = () => resetInactivityTimer();
            events.forEach(e => document.addEventListener(e, handleActivity));
            resetInactivityTimer();
            return () => {
                events.forEach(e => document.removeEventListener(e, handleActivity));
                if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            };
        }
    }, [user]);

    const login = (email, password) => supabase.auth.signInWithPassword({ email, password });

    const register = (email, password, fullName, role = 'user') => {
        return supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, role: role, department: 'General' } }
        });
    };

    const contextValue = useMemo(() => ({
        user,
        profile,
        loading,
        login,
        register,
        logout,
        authError,
        setAuthError
    }), [user, profile, loading, authError]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}