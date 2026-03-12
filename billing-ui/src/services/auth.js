// Auth and tenant management service
// Super admin can manage all tenants. Tenant admin is restricted to their own.

const STORAGE_KEYS = {
  AUTH: 'kb_auth',
  TENANTS: 'kb_tenants',
  ACTIVE_TENANT: 'kb_active_tenant',
};

// Default super admin (Kill Bill built-in)
const SUPER_ADMIN = { username: 'admin', password: 'password', role: 'super_admin' };

// Get stored tenants registry
export const getTenants = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TENANTS) || '[]');
  } catch { return []; }
};

export const saveTenants = (tenants) => {
  localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
};

export const addTenant = (tenant) => {
  const tenants = getTenants();
  tenants.push(tenant);
  saveTenants(tenants);
  return tenants;
};

export const removeTenant = (apiKey) => {
  const tenants = getTenants().filter(t => t.apiKey !== apiKey);
  saveTenants(tenants);
  return tenants;
};

// Active tenant
export const getActiveTenant = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT));
  } catch { return null; }
};

export const setActiveTenant = (tenant) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, JSON.stringify(tenant));
};

// Auth session
export const getAuth = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTH));
  } catch { return null; }
};

export const setAuth = (auth) => {
  localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
};

export const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEYS.AUTH);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT);
};

// Login validation
export const login = (username, password) => {
  // Super admin
  if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
    const auth = { username, role: 'super_admin', tenantApiKey: null };
    setAuth(auth);
    return auth;
  }

  // Tenant admin — stored in tenant registry
  const tenants = getTenants();
  const tenant = tenants.find(t =>
    t.adminUsername === username && t.adminPassword === password
  );
  if (tenant) {
    const auth = { username, role: 'tenant_admin', tenantApiKey: tenant.apiKey };
    setAuth(auth);
    setActiveTenant(tenant);
    return auth;
  }

  return null;
};

export const isSuperAdmin = (auth) => auth?.role === 'super_admin';
export const isTenantAdmin = (auth) => auth?.role === 'tenant_admin';
