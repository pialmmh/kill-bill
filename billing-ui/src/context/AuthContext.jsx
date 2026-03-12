import { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth, setAuth as saveAuth, clearAuth,
  getActiveTenant, setActiveTenant as saveActiveTenant,
  getTenants, isSuperAdmin, login as doLogin,
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(() => getAuth());
  const [activeTenant, setActiveTenantState] = useState(() => getActiveTenant());

  const login = (username, password) => {
    const result = doLogin(username, password);
    if (result) {
      setAuthState(result);
      if (result.tenantApiKey) {
        const tenant = getTenants().find(t => t.apiKey === result.tenantApiKey);
        if (tenant) setActiveTenantState(tenant);
      }
    }
    return result;
  };

  const logout = () => {
    clearAuth();
    setAuthState(null);
    setActiveTenantState(null);
  };

  const switchTenant = (tenant) => {
    saveActiveTenant(tenant);
    setActiveTenantState(tenant);
  };

  const isSuper = isSuperAdmin(auth);

  // Available tenants for the dropdown
  const availableTenants = isSuper ? getTenants() : (activeTenant ? [activeTenant] : []);

  return (
    <AuthContext.Provider value={{
      auth, activeTenant, isSuper,
      login, logout, switchTenant,
      availableTenants, isLoggedIn: !!auth,
      refreshTenants: () => {
        // Force re-render when tenant list changes
        setAuthState({ ...auth });
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
