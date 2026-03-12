import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Tooltip, TextField, InputAdornment,
} from '@mui/material';
import { Receipt as ReceiptIcon, Print, Search as SearchIcon } from '@mui/icons-material';
import StatusChip from '../components/StatusChip';
import PaymentReceipt from '../components/PaymentReceipt';
import { getAccounts, getAccountPayments, getPayment, getInvoice } from '../services/killbill';
import { getPlanFeatures } from '../services/planFeatures';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const PAYMENT_METHODS = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', BKASH: 'bKash',
  NAGAD: 'Nagad', ROCKET: 'Rocket', CHEQUE: 'Cheque',
  ONLINE: 'Online / Gateway', OTHER: 'Other',
};

export default function Payments() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [receiptAccount, setReceiptAccount] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const accRes = await getAccounts(0, 500);
        const accounts = accRes.data || [];
        const all = [];
        await Promise.all(accounts.map(async (acc) => {
          try {
            const payRes = await getAccountPayments(acc.accountId);
            (payRes.data || []).forEach(p => all.push({
              ...p,
              accountName: acc.name,
              accountId: acc.accountId,
              accountExternalKey: acc.externalKey,
              accountData: acc,
            }));
          } catch { /* skip */ }
        }));
        // Sort by date descending
        all.sort((a, b) => {
          const da = a.transactions?.[0]?.effectiveDate || '';
          const db = b.transactions?.[0]?.effectiveDate || '';
          return new Date(db) - new Date(da);
        });
        setRows(all);
      } catch { toast.error('Failed to load payments'); }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.accountName || '').toLowerCase().includes(q)
      || (p.accountExternalKey || '').toLowerCase().includes(q)
      || (p.paymentNumber?.toString() || '').includes(q)
      || (p.paymentId || '').toLowerCase().includes(q)
      || (p.transactions?.[0]?.transactionExternalKey || '').toLowerCase().includes(q);
  });

  const viewReceipt = async (p) => {
    try {
      const payRes = await getPayment(p.paymentId);
      setReceiptPayment(payRes.data);
      setReceiptAccount(p.accountData);
      setReceiptInvoice(null); // we don't have invoice linkage in list view
      setReceiptOpen(true);
    } catch { toast.error('Failed to load receipt'); }
  };

  const handlePrintReceipt = () => {
    const el = document.getElementById('payments-receipt-print');
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title>
      <style>body{font-family:Inter,Arial,sans-serif;margin:0;padding:20px}
      table{width:100%;border-collapse:collapse}td{padding:4px 8px;vertical-align:top}
      hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0}
      @media print{body{padding:0}}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // Summary
  const totalAmount = filtered.reduce((s, p) =>
    s + (p.transactions || []).reduce((ts, t) =>
      ts + (t.status === 'SUCCESS' ? parseFloat(t.amount || 0) : 0), 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">All Payments</Typography>
        <Chip label={`Total: ৳${totalAmount.toLocaleString()}`} color="success" variant="outlined" />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search by customer, payment #, or reference..."
          value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 360 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Payment #</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Method / Ref</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Receipt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No payments found</TableCell></TableRow>
                ) : filtered.map((p) => {
                  const txn = p.transactions?.[0];
                  const refKey = txn?.transactionExternalKey || '';
                  const refParts = refKey.split(':');
                  const method = PAYMENT_METHODS[refParts[0]] || refParts[0] || '-';
                  const ref = refParts[1] || '';
                  return (
                    <TableRow key={p.paymentId} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {p.paymentNumber || p.paymentId?.slice(0, 12)}
                      </TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        onClick={() => navigate(`/customers/${p.accountId}`)}
                      >
                        {p.accountName || p.accountExternalKey || '-'}
                      </TableCell>
                      <TableCell>{txn ? dayjs(txn.effectiveDate).format('YYYY-MM-DD HH:mm') : '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 12 }}>{method}</Typography>
                        {ref && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{ref}</Typography>}
                      </TableCell>
                      <TableCell>
                        {(p.transactions || []).map((t, i) => (
                          <Chip key={i} label={t.transactionType} size="small" sx={{ fontSize: 10, height: 18, mr: 0.5 }} variant="outlined" />
                        ))}
                      </TableCell>
                      <TableCell>
                        {(p.transactions || []).map((t, i) => (
                          <StatusChip key={i} status={t.status} />
                        ))}
                      </TableCell>
                      <TableCell align="right">
                        {(p.transactions || []).map((t, i) => (
                          <Typography key={i} variant="body2">৳{parseFloat(t.amount || 0).toLocaleString()}</Typography>
                        ))}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Receipt">
                          <IconButton size="small" onClick={() => viewReceipt(p)}>
                            <ReceiptIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Payment Receipt
          <Button size="small" startIcon={<Print />} onClick={handlePrintReceipt}>Print</Button>
        </DialogTitle>
        <DialogContent>
          <Box id="payments-receipt-print">
            <PaymentReceipt
              payment={receiptPayment}
              invoice={receiptInvoice}
              account={receiptAccount}
              planLabel={(planName) => getPlanFeatures(planName)?.displayName || planName}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReceiptOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
