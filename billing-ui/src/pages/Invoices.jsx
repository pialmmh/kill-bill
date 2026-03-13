import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Button, Grid, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import { Payment, CheckCircle, History, Print, AttachFile } from '@mui/icons-material';
import StatusChip from '../components/StatusChip';
import {
  getAccounts, getAccountInvoices, payInvoice, getInvoicePayments, getPayment, getInvoice,
} from '../services/killbill';
import { getPlanFeatures } from '../services/planFeatures';
import { saveAttachment } from '../services/attachments';
import PaymentReceipt from '../components/PaymentReceipt';
import { useNotification } from '../components/ErrorNotification';
import { extractError } from '../services/errorHelper';
import dayjs from 'dayjs';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'ROCKET', label: 'Rocket' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE', label: 'Online / Gateway' },
  { value: 'OTHER', label: 'Other' },
];

export default function Invoices() {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pay dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [invPayments, setInvPayments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [receiptAccount, setReceiptAccount] = useState(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const accRes = await getAccounts(0, 200);
      const accounts = accRes.data || [];
      const allInvoices = [];
      await Promise.all(accounts.map(async (acc) => {
        try {
          const res = await getAccountInvoices(acc.accountId);
          (res.data || []).forEach(inv =>
            allInvoices.push({ ...inv, accountName: acc.name, accountId: acc.accountId, accountData: acc })
          );
        } catch { /* skip */ }
      }));
      allInvoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
      setInvoices(allInvoices);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadInvoices(); }, []);

  const openPayDialog = async (inv) => {
    const balance = parseFloat(inv.balance || 0);
    if (balance <= 0) { notifyError('Invoice already paid'); return; }
    setPayTarget(inv);
    setPayAmount(balance.toString());
    setPayMethod('CASH');
    setPayReference('');
    setPayNote('');
    setPendingFiles([]);
    setPayDialogOpen(true);
    try {
      const res = await getInvoicePayments(inv.invoiceId);
      setInvPayments(res.data || []);
    } catch { setInvPayments([]); }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      if (f.size > 5 * 1024 * 1024) { notifyError(`${f.name} exceeds 5MB limit`); return false; }
      return true;
    });
    setPendingFiles(prev => [...prev, ...valid]);
    e.target.value = '';
  };

  const removePendingFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { notifyError('Enter a valid amount'); return; }
    const balance = parseFloat(payTarget.balance);
    if (amount > balance) { notifyError(`Amount exceeds balance (৳${balance.toLocaleString()})`); return; }
    const refParts = [payMethod];
    if (payReference) refParts.push(payReference);
    if (payNote) refParts.push(payNote);
    try {
      setPaying(true);
      const res = await payInvoice(payTarget.invoiceId, payTarget.accountId, amount, {
        currency: payTarget.currency || 'BDT',
        transactionExternalKey: refParts.join(':'),
      });
      success(`Payment of ৳${amount.toLocaleString()} recorded`);
      setPayDialogOpen(false);

      // Save attachments + show receipt
      const paymentId = res.headers?.location?.split('/').pop();
      if (paymentId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await saveAttachment(paymentId, file);
        }
        success(`${pendingFiles.length} attachment(s) saved`);
      }
      if (paymentId) {
        try {
          const [payRes, invRes] = await Promise.all([
            getPayment(paymentId),
            getInvoice(payTarget.invoiceId),
          ]);
          setReceiptPayment(payRes.data);
          setReceiptInvoice(invRes.data);
          setReceiptAccount(payTarget.accountData);
          setReceiptOpen(true);
        } catch { /* not critical */ }
      }
      loadInvoices();
    } catch (e) {
      const { message, detail } = extractError(e, 'Payment failed');
      notifyError(message, detail);
    } finally { setPaying(false); }
  };

  const handlePrintReceipt = () => {
    const el = document.getElementById('inv-receipt-print');
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

  const visibleInvoices = invoices.filter(inv => parseFloat(inv.amount || 0) > 0);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>All Invoices</Typography>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No invoices</TableCell>
                  </TableRow>
                ) : visibleInvoices.map((inv) => {
                  const amount = parseFloat(inv.amount || 0);
                  const balance = parseFloat(inv.balance || 0);
                  const paid = amount - balance;
                  const isPartial = paid > 0 && balance > 0;
                  return (
                    <TableRow key={inv.invoiceId} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNumber || inv.invoiceId?.slice(0, 8)}</TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                        onClick={() => navigate(`/customers/${inv.accountId}`)}
                      >
                        {inv.accountName || '-'}
                      </TableCell>
                      <TableCell>{dayjs(inv.invoiceDate).format('YYYY-MM-DD')}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(inv.items || []).map((item, i) => {
                            const pf = getPlanFeatures(item.planName);
                            return <Chip key={i} size="small" label={pf?.displayName || item.planName} sx={{ fontSize: 10, height: 20 }} />;
                          })}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={inv.status} />
                        {isPartial && <Chip label="Partial" size="small" sx={{ ml: 0.5, fontSize: 10, height: 18, bgcolor: '#fff3e0', color: '#e65100' }} />}
                      </TableCell>
                      <TableCell align="right">৳{amount.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: '#2e7d32' }}>৳{paid.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: balance > 0 ? 600 : 400, color: balance > 0 ? '#c62828' : '#2e7d32' }}>
                        ৳{balance.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {balance > 0 ? (
                          <Button size="small" variant="contained" startIcon={<Payment />}
                            onClick={() => openPayDialog(inv)} sx={{ fontSize: 11, py: 0.3 }}>
                            Pay
                          </Button>
                        ) : (
                          <Chip label="Paid" size="small" icon={<CheckCircle sx={{ fontSize: 14 }} />}
                            sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontSize: 11 }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {payTarget && (
            <Box>
              <Box sx={{ bgcolor: '#f8f9fa', borderRadius: 1, p: 2, mb: 2, mt: 1 }}>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Invoice</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>#{payTarget.invoiceNumber}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Customer</Typography>
                    <Typography variant="body2">{payTarget.accountName}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Balance</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#c62828' }}>
                      ৳{parseFloat(payTarget.balance).toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
                {(payTarget.items || []).length > 0 && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e5e7eb' }}>
                    {payTarget.items.map((item, i) => {
                      const pf = getPlanFeatures(item.planName);
                      return (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.2 }}>
                          <Typography variant="caption">{pf?.displayName || item.planName}</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>৳{parseFloat(item.amount).toLocaleString()}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {invPayments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <History sx={{ fontSize: 14 }} /> Previous Payments
                  </Typography>
                  {invPayments.map((p, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3, px: 1, bgcolor: '#f0fdf4', borderRadius: 1, mb: 0.5 }}>
                      <Typography variant="caption">
                        {dayjs(p.effectiveDate || p.transactions?.[0]?.effectiveDate).format('YYYY-MM-DD')}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 500, color: '#2e7d32' }}>
                        ৳{(p.transactions || []).reduce((s, t) => s + parseFloat(t.amount || 0), 0).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" label="Amount (BDT)" type="number"
                    value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    inputProps={{ min: 0.01, max: parseFloat(payTarget.balance), step: 0.01 }}
                    helperText={
                      parseFloat(payAmount) < parseFloat(payTarget.balance)
                        ? `Partial — ৳${(parseFloat(payTarget.balance) - parseFloat(payAmount || 0)).toLocaleString()} remains`
                        : 'Full payment'
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Payment Method" select
                    value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Reference / TrxID"
                    value={payReference} onChange={(e) => setPayReference(e.target.value)}
                    placeholder="Bank ref, bKash TrxID, cheque #" />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Note (optional)"
                    value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button size="small" variant="outlined" onClick={() => setPayAmount(payTarget.balance.toString())}>
                  Full (৳{parseFloat(payTarget.balance).toLocaleString()})
                </Button>
                <Button size="small" variant="outlined" onClick={() => setPayAmount((parseFloat(payTarget.balance) / 2).toFixed(2))}>
                  Half
                </Button>
              </Box>

              {/* File Attachments */}
              <Box sx={{ border: '1px dashed #ccc', borderRadius: 1, p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: pendingFiles.length > 0 ? 1 : 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    <AttachFile sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    Attach receipt, cheque, bank slip (PDF, JPG, PNG — max 5MB)
                  </Typography>
                  <Button size="small" component="label" variant="outlined" sx={{ fontSize: 11 }}>
                    Browse
                    <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                      onChange={handleFileSelect} />
                  </Button>
                </Box>
                {pendingFiles.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {pendingFiles.map((f, i) => (
                      <Chip key={i} label={`${f.name} (${(f.size / 1024).toFixed(0)}KB)`}
                        size="small" sx={{ fontSize: 11 }}
                        onDelete={() => removePendingFile(i)} />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePay} disabled={paying} startIcon={<Payment />}>
            {paying ? 'Processing...' : `Record ৳${parseFloat(payAmount || 0).toLocaleString()}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Payment Receipt
          <Button size="small" startIcon={<Print />} onClick={handlePrintReceipt}>Print</Button>
        </DialogTitle>
        <DialogContent>
          <Box id="inv-receipt-print">
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
