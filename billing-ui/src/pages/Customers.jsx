import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, CircularProgress, Alert, MenuItem,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { getAccounts, createAccount } from '../services/killbill';
import { useNotification } from '../components/ErrorNotification';
import { extractError } from '../services/errorHelper';

const emptyForm = {
  name: '', email: '', phone: '', company: '',
  externalKey: '', currency: 'BDT', country: 'BD',
  address1: '', city: '', locale: 'en_BD', timeZone: 'Asia/Dhaka',
};

export default function Customers() {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await getAccounts(0, 200);
      setAccounts(res.data || []);
    } catch (e) {
      notifyError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.externalKey) {
      notifyError('Name and External Key are required');
      return;
    }
    try {
      setSaving(true);
      await createAccount(form);
      success('Customer created');
      setDialogOpen(false);
      setForm(emptyForm);
      loadAccounts();
    } catch (e) {
      const { message, detail } = extractError(e, 'Failed to create customer');
      notifyError(message, detail);
    } finally {
      setSaving(false);
    }
  };

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Customers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Customer
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>External Key</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => (
                    <TableRow
                      key={acc.accountId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/customers/${acc.accountId}`)}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.externalKey || '-'}</TableCell>
                      <TableCell>{acc.name || '-'}</TableCell>
                      <TableCell>{acc.email || '-'}</TableCell>
                      <TableCell>{acc.phone || '-'}</TableCell>
                      <TableCell>{acc.company || '-'}</TableCell>
                      <TableCell>{acc.currency}</TableCell>
                      <TableCell align="right">৳{parseFloat(acc.accountBalance || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Customer</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Name *" value={form.name} onChange={setField('name')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="External Key *" value={form.externalKey} onChange={setField('externalKey')} placeholder="e.g. ISP-001" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Email" value={form.email} onChange={setField('email')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Phone" value={form.phone} onChange={setField('phone')} placeholder="+8801..." />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Company" value={form.company} onChange={setField('company')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Currency" select value={form.currency} onChange={setField('currency')}>
                <MenuItem value="BDT">BDT</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Address" value={form.address1} onChange={setField('address1')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="City" value={form.city} onChange={setField('city')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
