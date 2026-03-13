import axios from 'axios';
import { getActiveTenant, getAuth } from './auth';

// Create axios instance — headers are set dynamically per request
const api = axios.create({
  baseURL: '/1.0/kb',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: inject tenant + auth headers from current session
api.interceptors.request.use((config) => {
  const auth = getAuth();
  const tenant = getActiveTenant();

  // Basic auth — always admin:password for Kill Bill API
  config.auth = { username: 'admin', password: 'password' };

  // Tenant headers — from active tenant selection
  if (tenant) {
    config.headers['X-Killbill-ApiKey'] = tenant.apiKey;
    config.headers['X-Killbill-ApiSecret'] = tenant.apiSecret;
  }

  config.headers['X-Killbill-CreatedBy'] = auth?.username || 'billing-ui';
  return config;
});

// System-level requests (no tenant headers needed)
const systemApi = axios.create({
  baseURL: '/1.0/kb',
  auth: { username: 'admin', password: 'password' },
  headers: { 'Content-Type': 'application/json' },
});

// ==================== TENANT MANAGEMENT ====================
export const createTenantInKB = (apiKey, apiSecret, externalKey) =>
  systemApi.post('/tenants', { apiKey, apiSecret, externalKey });

export const getTenantByApiKey = (apiKey) =>
  systemApi.get(`/tenants?apiKey=${apiKey}`);

// ==================== HEALTHCHECK ====================
export const healthcheck = () => systemApi.get('/healthcheck');

// ==================== ACCOUNTS ====================
export const getAccounts = (offset = 0, limit = 100) =>
  api.get('/accounts/pagination', { params: { offset, limit } });
export const getAccount = (id) => api.get(`/accounts/${id}?accountWithBalanceAndCBA=true`);
export const getAccountByKey = (key) => api.get(`/accounts?externalKey=${key}&accountWithBalanceAndCBA=true`);
export const createAccount = (data) => api.post('/accounts', data);

// ==================== SUBSCRIPTIONS ====================
export const getAccountBundles = (accountId) => api.get(`/accounts/${accountId}/bundles`);
export const createSubscription = (data) => api.post('/subscriptions', data);
export const cancelSubscription = (id) => api.delete(`/subscriptions/${id}`);
export const pauseSubscription = (id) => api.put(`/subscriptions/${id}/pause`);
export const resumeSubscription = (id) => api.put(`/subscriptions/${id}/resume`);
export const getSubscription = (id) => api.get(`/subscriptions/${id}`);

// ==================== INVOICES ====================
export const getAccountInvoicesList = (accountId) =>
  api.get(`/accounts/${accountId}/invoices`);
export const getInvoice = (id) => api.get(`/invoices/${id}?withItems=true`);
export const getAccountInvoices = async (accountId) => {
  const listRes = await api.get(`/accounts/${accountId}/invoices`);
  const invoices = listRes.data || [];
  const enriched = await Promise.all(
    invoices.map(async (inv) => {
      try {
        const full = await api.get(`/invoices/${inv.invoiceId}?withItems=true`);
        return full.data;
      } catch { return inv; }
    })
  );
  return { ...listRes, data: enriched };
};

// ==================== PAYMENTS ====================
export const getAccountPayments = (accountId) => api.get(`/accounts/${accountId}/payments`);
export const getAccountPaymentsWithAttempts = (accountId) =>
  api.get(`/accounts/${accountId}/payments?withAttempts=true`);
export const createPayment = (accountId, data) =>
  api.post(`/accounts/${accountId}/payments`, data);
// Get a single payment by ID
export const getPayment = (paymentId) =>
  api.get(`/payments/${paymentId}?withAttempts=true`);

// Pay an invoice — external (manual) or gateway-initiated
// transactionExternalKey: external reference (bank ref, bKash TrxID, gateway order ID)
// This same endpoint is used for both manual admin payments and gateway callbacks.
// For gateway integration: call this from your gateway callback handler with the
// gateway's transaction reference as transactionExternalKey.
export const payInvoice = (invoiceId, accountId, amount, {
  currency = 'BDT',
  transactionExternalKey = null,
  paymentMethodId = null,
} = {}) => {
  const body = {
    accountId,
    purchasedAmount: amount,
    currency,
  };
  const params = {};
  // External payment (manual / no gateway plugin)
  if (!paymentMethodId) {
    params.externalPayment = true;
  } else {
    body.paymentMethodId = paymentMethodId;
  }
  if (transactionExternalKey) {
    body.paymentExternalKey = transactionExternalKey;
  }
  return api.post(`/invoices/${invoiceId}/payments`, body, { params });
};

// Get payments for a specific invoice
export const getInvoicePayments = (invoiceId) =>
  api.get(`/invoices/${invoiceId}/payments`);

// Search payments (all tenants — system level for cross-customer reports)
export const searchPayments = (searchKey, offset = 0, limit = 100) =>
  api.get('/payments/search/' + encodeURIComponent(searchKey), { params: { offset, limit } });

// ==================== CATALOG ====================
export const getCatalog = () => api.get('/catalog', { headers: { Accept: 'application/json' } });
export const uploadCatalog = (xmlContent) =>
  api.post('/catalog/xml', xmlContent, { headers: { 'Content-Type': 'text/xml' } });

// ==================== OVERDUE ====================
export const getOverdueState = (accountId) => api.get(`/accounts/${accountId}/overdue`);
export const uploadOverdueConfig = (xmlContent) =>
  api.post('/overdue/xml', xmlContent, { headers: { 'Content-Type': 'text/xml' } });

// ==================== CUSTOM FIELDS ====================
export const getSubscriptionCustomFields = (subscriptionId) =>
  api.get(`/subscriptions/${subscriptionId}/customFields`);
export const setSubscriptionCustomFields = (subscriptionId, fields) =>
  api.post(`/subscriptions/${subscriptionId}/customFields`, fields);

// ==================== TAGS ====================
export const getAccountTags = (accountId) => api.get(`/accounts/${accountId}/tags`);

export default api;
