import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, IconButton, Chip, Tooltip, Alert, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Delete, Upload, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getTenants, addTenant, removeTenant, saveTenants } from '../services/auth';
import { createTenantInKB, getTenantByApiKey } from '../services/killbill';
import { useNotification } from '../components/ErrorNotification';
import { extractError } from '../services/errorHelper';

const emptyForm = {
  name: '', apiKey: '', apiSecret: '', externalKey: '',
  adminUsername: '', adminPassword: '',
  catalogFile: null,
};

export default function Tenants() {
  const { isSuper, refreshTenants } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [tenants, setTenantsState] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState({});

  useEffect(() => { setTenantsState(getTenants()); }, []);

  if (!isSuper) {
    return <Alert severity="warning">Only super admin can manage tenants.</Alert>;
  }

  const setField = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  const handleCreate = async () => {
    if (!form.name || !form.apiKey || !form.apiSecret || !form.adminUsername || !form.adminPassword) {
      notifyError('All fields are required');
      return;
    }
    // Check duplicate
    if (tenants.find(t => t.apiKey === form.apiKey)) {
      notifyError('Tenant with this API key already exists');
      return;
    }
    try {
      setSaving(true);

      // Create tenant in Kill Bill
      await createTenantInKB(form.apiKey, form.apiSecret, form.externalKey || form.apiKey);

      // Save to local registry
      const tenant = {
        name: form.name,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        externalKey: form.externalKey || form.apiKey,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword,
        createdAt: new Date().toISOString(),
        kbRegistered: true,
      };
      const updated = addTenant(tenant);
      setTenantsState(updated);
      refreshTenants();
      success(`Tenant "${form.name}" created`);
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message;
      if (errMsg?.includes('already exists')) {
        // Tenant exists in KB but not in local registry — add it
        const tenant = {
          name: form.name,
          apiKey: form.apiKey,
          apiSecret: form.apiSecret,
          externalKey: form.externalKey || form.apiKey,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          createdAt: new Date().toISOString(),
          kbRegistered: true,
        };
        const updated = addTenant(tenant);
        setTenantsState(updated);
        refreshTenants();
        success(`Tenant "${form.name}" registered (already existed in Kill Bill)`);
        setDialogOpen(false);
        setForm(emptyForm);
      } else {
        const { message, detail } = extractError(e, 'Failed to create tenant');
        notifyError(message, detail);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (apiKey, name) => {
    if (!confirm(`Remove tenant "${name}" from the registry?\n\nThis only removes the local entry. Kill Bill tenant data is preserved.`)) return;
    const updated = removeTenant(apiKey);
    setTenantsState(updated);
    refreshTenants();
    success(`Tenant "${name}" removed from registry`);
  };

  const handleVerify = async (apiKey) => {
    setChecking(prev => ({ ...prev, [apiKey]: 'loading' }));
    try {
      await getTenantByApiKey(apiKey);
      setChecking(prev => ({ ...prev, [apiKey]: 'ok' }));
      // Update registry
      const updated = tenants.map(t => t.apiKey === apiKey ? { ...t, kbRegistered: true } : t);
      saveTenants(updated);
      setTenantsState(updated);
    } catch {
      setChecking(prev => ({ ...prev, [apiKey]: 'error' }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tenant Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Tenant
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>API Key</TableCell>
                <TableCell>Admin User</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>KB Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No tenants registered. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={t.apiKey} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.apiKey}</TableCell>
                    <TableCell>{t.adminUsername}</TableCell>
                    <TableCell>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {checking[t.apiKey] === 'loading' ? (
                        <CircularProgress size={16} />
                      ) : checking[t.apiKey] === 'ok' || t.kbRegistered ? (
                        <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Registered" size="small"
                          sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontSize: 11 }} />
                      ) : checking[t.apiKey] === 'error' ? (
                        <Chip icon={<ErrorIcon sx={{ fontSize: 14 }} />} label="Not Found" size="small"
                          sx={{ bgcolor: '#fce4ec', color: '#c62828', fontSize: 11 }} />
                      ) : (
                        <Button size="small" onClick={() => handleVerify(t.apiKey)} sx={{ fontSize: 11 }}>
                          Verify
                        </Button>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove from registry">
                        <IconButton size="small" color="error" onClick={() => handleDelete(t.apiKey, t.name)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Tenant Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Tenant</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This creates a tenant in Kill Bill and registers a tenant admin for the billing UI.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Tenant Name *" value={form.name}
                onChange={setField('name')} placeholder="e.g. Telcobright ISP" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="API Key *" value={form.apiKey}
                onChange={setField('apiKey')} placeholder="e.g. telcobright-isp" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="API Secret *" value={form.apiSecret}
                onChange={setField('apiSecret')} placeholder="e.g. my-secret-123" type="password" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="External Key" value={form.externalKey}
                onChange={setField('externalKey')} placeholder="Optional, defaults to API Key" />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Tenant Admin Credentials</Typography>
              <Typography variant="caption" color="text.secondary">
                This admin can only access this tenant's data in the billing UI.
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Admin Username *" value={form.adminUsername}
                onChange={setField('adminUsername')} placeholder="e.g. isp-admin" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Admin Password *" value={form.adminPassword}
                onChange={setField('adminPassword')} type="password" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Tenant'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
