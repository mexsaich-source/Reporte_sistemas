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

        // Safety timeout: If Supabase takes more than 3 seconds to respond, force loading to false
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
        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
    };

    const logout = async () => {
        try {
            if (user?.id === 'demo-user') return;
            await supabase.auth.signOut();
        } catch (err) {
            console.error("Error al salir:", err);
        } finally {
            setUser(null);
            setProfile(null);
            setLoading(false);
        }
    };

    // Helper options for demo purposes without DB connection
    const forceDemoLogin = (role) => {
        setUser({ id: 'demo-user', email: 'demo@mexsa.com' });
        setProfile({ id: 'demo-user', role: role, full_name: `Dev ${role}` });
        setLoading(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            login,
            register,
            logout,
            forceDemoLogin
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
