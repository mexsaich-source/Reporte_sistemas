import { createContext, useContext } from 'react';

/**
 * Contexto de autenticación.
 * Se separa en este archivo para evitar problemas de Vite Fast Refresh
 * al mezclar exportaciones de componentes con valores de datos.
 */
export const AuthContext = createContext({});

/**
 * Hook personalizado para acceder al estado de autenticación.
 */
export function useAuth() {
    return useContext(AuthContext);
}
