import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Grid, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Tooltip, TextField, InputAdornment, Alert,
} from '@mui/material';
import {
  Receipt as ReceiptIcon, Print, Search as SearchIcon,
  Payment as PaymentIcon, Add as AddIcon, History,
  AttachFile, Delete as DeleteIcon, Visibility,
} from '@mui/icons-material';
import StatusChip from '../components/StatusChip';
import PaymentReceipt from '../components/PaymentReceipt';
import {
  getAccounts, getAccountPayments, getPayment, getInvoice,
  getAccountInvoices, payInvoice, getInvoicePayments,
} from '../services/killbill';
import { getPlanFeatures } from '../services/planFeatures';
import { saveAttachment, getAttachments, deleteAttachment } from '../services/attachments';
import { useNotification } from '../components/ErrorNotification';
import { extractError } from '../services/errorHelper';
import dayjs from 'dayjs';

const PAYMENT_METHODS_MAP = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', BKASH: 'bKash',
  NAGAD: 'Nagad', ROCKET: 'Rocket', CHEQUE: 'Cheque',
  ONLINE: 'Online / Gateway', OTHER: 'Other',
};
const PAYMENT_METHODS = Object.entries(PAYMENT_METHODS_MAP).map(([value, label]) => ({ value, label }));

export default function Payments() {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [receiptAccount, setReceiptAccount] = useState(null);

  // Record Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invPayments, setInvPayments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // files to upload with payment

  // Attachment viewer
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachKey, setAttachKey] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const accRes = await getAccounts(0, 500);
      const accts = accRes.data || [];
      setAccounts(accts);
      const all = [];
      await Promise.all(accts.map(async (acc) => {
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
      all.sort((a, b) => {
        const da = a.transactions?.[0]?.effectiveDate || '';
        const db = b.transactions?.[0]?.effectiveDate || '';
        return new Date(db) - new Date(da);
      });
      setRows(all);
    } catch { notifyError('Failed to load payments'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // When account is selected, load unpaid invoices
  const handleAccountChange = async (accountId) => {
    setSelectedAccountId(accountId);
    setSelectedInvoiceId('');
    setSelectedInvoice(null);
    setUnpaidInvoices([]);
    setInvPayments([]);
    if (!accountId) return;
    try {
      setLoadingInvoices(true);
      const res = await getAccountInvoices(accountId);
      const allInv = res.data || [];
      const unpaid = allInv.filter(inv => parseFloat(inv.balance || 0) > 0 && parseFloat(inv.amount || 0) > 0);
      setUnpaidInvoices(unpaid);
    } catch { notifyError('Failed to load invoices'); }
    setLoadingInvoices(false);
  };

  // When invoice is selected, set amount and load history
  const handleInvoiceChange = async (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    const inv = unpaidInvoices.find(i => i.invoiceId === invoiceId);
    setSelectedInvoice(inv || null);
    if (inv) {
      setPayAmount(parseFloat(inv.balance).toString());
      try {
        const res = await getInvoicePayments(invoiceId);
        setInvPayments(res.data || []);
      } catch { setInvPayments([]); }
    }
  };

  const openPayDialog = () => {
    setSelectedAccountId('');
    setSelectedInvoiceId('');
    setSelectedInvoice(null);
    setUnpaidInvoices([]);
    setPayAmount('');
    setPayMethod('CASH');
    setPayReference('');
    setPayNote('');
    setInvPayments([]);
    setPendingFiles([]);
    setPayOpen(true);
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

  const removePendingFile = (idx) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const viewAttachments = (paymentId) => {
    const files = getAttachments(paymentId);
    setAttachKey(paymentId);
    setAttachFiles(files);
    setPreviewFile(null);
    setAttachOpen(true);
  };

  const handleDeleteAttachment = (attId) => {
    deleteAttachment(attachKey, attId);
    setAttachFiles(getAttachments(attachKey));
  };

  const handlePay = async () => {
    if (!selectedAccountId || !selectedInvoiceId) {
      notifyError('Select customer and invoice');
      return;
    }
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { notifyError('Enter a valid amount'); return; }
    const balance = parseFloat(selectedInvoice?.balance || 0);
    if (amount > balance) { notifyError(`Amount exceeds balance (৳${balance.toLocaleString()})`); return; }

    const refParts = [payMethod];
    if (payReference) refParts.push(payReference);
    if (payNote) refParts.push(payNote);

    try {
      setPaying(true);
      const res = await payInvoice(selectedInvoiceId, selectedAccountId, amount, {
        currency: selectedInvoice?.currency || 'BDT',
        transactionExternalKey: refParts.join(':'),
      });
      success(`Payment of ৳${amount.toLocaleString()} recorded`);
      setPayOpen(false);

      // Save attachments
      const paymentId = res.headers?.location?.split('/').pop();
      if (paymentId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await saveAttachment(paymentId, file);
        }
        success(`${pendingFiles.length} attachment(s) saved`);
      }

      // Show receipt
      if (paymentId) {
        try {
          const [payRes, invRes] = await Promise.all([
            getPayment(paymentId),
            getInvoice(selectedInvoiceId),
          ]);
          setReceiptPayment(payRes.data);
          setReceiptInvoice(invRes.data);
          setReceiptAccount(accounts.find(a => a.accountId === selectedAccountId) || null);
          setReceiptOpen(true);
        } catch { /* not critical */ }
      }
      loadPayments();
    } catch (e) {
      const { message, detail } = extractError(e, 'Payment failed');
      notifyError(message, detail);
    } finally { setPaying(false); }
  };

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
      setReceiptInvoice(null);
      setReceiptOpen(true);
    } catch { notifyError('Failed to load receipt'); }
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

  const totalAmount = filtered.reduce((s, p) =>
    s + (p.transactions || []).reduce((ts, t) =>
      ts + (t.status === 'SUCCESS' ? parseFloat(t.amount || 0) : 0), 0), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">All Payments</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label={`Total: ৳${totalAmount.toLocaleString()}`} color="success" variant="outlined" />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openPayDialog}>
            Record Payment
          </Button>
        </Box>
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
                  const method = PAYMENT_METHODS_MAP[refParts[0]] || refParts[0] || '-';
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
                        {getAttachments(p.paymentId).length > 0 && (
                          <Tooltip title={`${getAttachments(p.paymentId).length} attachment(s)`}>
                            <IconButton size="small" onClick={() => viewAttachments(p.paymentId)}>
                              <AttachFile fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {/* Step 1: Select Customer */}
            <TextField
              fullWidth size="small" label="Customer" select
              value={selectedAccountId} onChange={(e) => handleAccountChange(e.target.value)}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">-- Select Customer --</MenuItem>
              {accounts.map(acc => (
                <MenuItem key={acc.accountId} value={acc.accountId}>
                  {acc.name || acc.externalKey} {acc.company ? `(${acc.company})` : ''}
                </MenuItem>
              ))}
            </TextField>

            {/* Step 2: Select Invoice */}
            {selectedAccountId && (
              loadingInvoices ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
              ) : unpaidInvoices.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>No unpaid invoices for this customer.</Alert>
              ) : (
                <TextField
                  fullWidth size="small" label="Unpaid Invoice" select
                  value={selectedInvoiceId} onChange={(e) => handleInvoiceChange(e.target.value)}
                  sx={{ mb: 2 }}
                >
                  <MenuItem value="">-- Select Invoice --</MenuItem>
                  {unpaidInvoices.map(inv => (
                    <MenuItem key={inv.invoiceId} value={inv.invoiceId}>
                      #{inv.invoiceNumber} — {dayjs(inv.invoiceDate).format('YYYY-MM-DD')} — Balance: ৳{parseFloat(inv.balance).toLocaleString()} / ৳{parseFloat(inv.amount).toLocaleString()}
                    </MenuItem>
                  ))}
                </TextField>
              )
            )}

            {/* Step 3: Invoice details + payment form */}
            {selectedInvoice && (
              <>
                <Box sx={{ bgcolor: '#f8f9fa', borderRadius: 1, p: 2, mb: 2 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Invoice</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>#{selectedInvoice.invoiceNumber}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                      <Typography variant="body2">৳{parseFloat(selectedInvoice.amount).toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#c62828' }}>
                        ৳{parseFloat(selectedInvoice.balance).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>
                  {(selectedInvoice.items || []).length > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e5e7eb' }}>
                      {selectedInvoice.items.map((item, i) => {
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

                {/* Previous payments */}
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
                      inputProps={{ min: 0.01, max: parseFloat(selectedInvoice.balance), step: 0.01 }}
                      helperText={
                        parseFloat(payAmount) < parseFloat(selectedInvoice.balance)
                          ? `Partial — ৳${(parseFloat(selectedInvoice.balance) - parseFloat(payAmount || 0)).toLocaleString()} remains`
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
                  <Button size="small" variant="outlined" onClick={() => setPayAmount(selectedInvoice.balance.toString())}>
                    Full (৳{parseFloat(selectedInvoice.balance).toLocaleString()})
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => setPayAmount((parseFloat(selectedInvoice.balance) / 2).toFixed(2))}>
                    Half
                  </Button>
                </Box>

                {/* File Attachments */}
                <Box sx={{ border: '1px dashed #ccc', borderRadius: 1, p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: pendingFiles.length > 0 ? 1 : 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      <AttachFile sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                      Attach receipt, cheque scan, bank slip (PDF, JPG, PNG — max 5MB)
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
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={handlePay} disabled={paying || !selectedInvoice}
            startIcon={<PaymentIcon />}
          >
            {paying ? 'Processing...' : `Record ৳${parseFloat(payAmount || 0).toLocaleString()} Payment`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Attachment Viewer Dialog */}
      <Dialog open={attachOpen} onClose={() => { setAttachOpen(false); setPreviewFile(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Payment Attachments</DialogTitle>
        <DialogContent>
          {previewFile ? (
            <Box>
              <Button size="small" onClick={() => setPreviewFile(null)} sx={{ mb: 1 }}>Back to list</Button>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{previewFile.name}</Typography>
              {previewFile.type?.startsWith('image/') ? (
                <Box component="img" src={previewFile.data} alt={previewFile.name}
                  sx={{ maxWidth: '100%', maxHeight: 500, borderRadius: 1, border: '1px solid #e5e7eb' }} />
              ) : previewFile.type === 'application/pdf' ? (
                <Box component="iframe" src={previewFile.data} title={previewFile.name}
                  sx={{ width: '100%', height: 500, border: '1px solid #e5e7eb', borderRadius: 1 }} />
              ) : (
                <Alert severity="info">Preview not available. <a href={previewFile.data} download={previewFile.name}>Download</a></Alert>
              )}
            </Box>
          ) : (
            attachFiles.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No attachments.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Uploaded</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attachFiles.map(att => (
                    <TableRow key={att.id}>
                      <TableCell>{att.name}</TableCell>
                      <TableCell>{(att.size / 1024).toFixed(0)} KB</TableCell>
                      <TableCell>{dayjs(att.uploadedAt).format('YYYY-MM-DD HH:mm')}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => setPreviewFile(att)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(att.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
          {/* Upload more */}
          {!previewFile && (
            <Box sx={{ mt: 2 }}>
              <Button size="small" component="label" variant="outlined" startIcon={<AttachFile />}>
                Add Attachment
                <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    for (const f of files) {
                      if (f.size > 5 * 1024 * 1024) { notifyError(`${f.name} exceeds 5MB`); continue; }
                      await saveAttachment(attachKey, f);
                    }
                    setAttachFiles(getAttachments(attachKey));
                    e.target.value = '';
                    success('Attachment(s) added');
                  }} />
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAttachOpen(false); setPreviewFile(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

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
