import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export const AuthContext = createContext({});

export const useAuth = () => {
    return useContext(AuthContext);
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Safety timeout
        const safetyTimer = setTimeout(() => {
            if (isMounted) setLoading(false);
        }, 3000);

        // Fetch current session
        const getSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (session?.user && isMounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (isMounted) {
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error al obtener sesión:", err);
                if (isMounted) setLoading(false);
            } finally {
                clearTimeout(safetyTimer);
            }
        };

        getSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session?.user && isMounted) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (isMounted) {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
            } else {
                setProfile(data);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const register = async (email, password, fullName) => {
        // 1. Creamos al usuario en el sistema de Auth de Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) return { data: null, error: authError };

        // 2. Obligamos a guardar el rol en tu tabla pública "profiles"
        if (authData?.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id,
                        full_name: fullName,
                        role: 'user',
                        department: 'General'
                    }
                ]);

            if (profileError) {
                console.error("Error insertando en profiles:", profileError);
            }
        }

        return { data: authData, error: authError };
    };

    const logout = async () => {
        setUser(null);
        setProfile(null);
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error("Error al salir:", err);
            localStorage.clear();
            sessionStorage.clear();
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;