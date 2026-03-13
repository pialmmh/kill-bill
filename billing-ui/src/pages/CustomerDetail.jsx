import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Button, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Alert, Tabs, Tab, IconButton, Tooltip,
  Stepper, Step, StepLabel, Divider,
} from '@mui/material';
import {
  ArrowBack, Add as AddIcon, Pause, PlayArrow, Cancel, Payment,
  CheckCircle, ShoppingCart, History, Receipt as ReceiptIcon, Print,
  AttachFile, Delete as DeleteIcon, Visibility,
} from '@mui/icons-material';
import StatusChip from '../components/StatusChip';
import {
  getAccount, getAccountBundles, getAccountInvoices,
  createSubscription, cancelSubscription, pauseSubscription, resumeSubscription,
  getOverdueState, payInvoice, getAccountPayments, getInvoicePayments,
  getPayment, getInvoice,
} from '../services/killbill';
import PaymentReceipt from '../components/PaymentReceipt';
import { getAllPlans, getPlanFeatures, getFeatureLabel, getProductName } from '../services/planFeatures';
import { saveAttachment, getAttachments, deleteAttachment } from '../services/attachments';
import { useNotification } from '../components/ErrorNotification';
import { extractError } from '../services/errorHelper';
import dayjs from 'dayjs';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [overdue, setOverdue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  // Purchase flow
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null); // invoice being paid
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState({}); // invoiceId -> payments[]

  // Receipt dialog
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);

  // Attachments
  const [pendingFiles, setPendingFiles] = useState([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachKey, setAttachKey] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  const { success, error: notifyError } = useNotification();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [accRes, bundlesRes, invRes, paymentsRes, overdueRes] = await Promise.all([
        getAccount(id),
        getAccountBundles(id),
        getAccountInvoices(id),
        getAccountPayments(id).catch(() => ({ data: [] })),
        getOverdueState(id).catch(() => null),
      ]);
      setAccount(accRes.data);
      setBundles(bundlesRes.data || []);
      setInvoices(invRes.data || []);
      setPayments(paymentsRes.data || []);
      if (overdueRes) setOverdue(overdueRes.data);
    } catch (e) {
      const { message, detail } = extractError(e, 'Failed to load customer');
      notifyError(message, detail);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const allSubscriptions = bundles.flatMap(b =>
    (b.subscriptions || []).map(s => ({ ...s, bundleExternalKey: b.externalKey }))
  );

  const allPlans = getAllPlans();
  const planKeys = Object.keys(allPlans);

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

  const viewAttachments = (paymentId) => {
    setAttachKey(paymentId);
    setAttachFiles(getAttachments(paymentId));
    setPreviewFile(null);
    setAttachOpen(true);
  };

  // Open payment dialog
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
      setInvoicePayments(prev => ({ ...prev, [inv.invoiceId]: res.data || [] }));
    } catch { /* ignore */ }
  };

  // Execute payment (full or partial)
  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { notifyError('Enter a valid amount'); return; }
    const balance = parseFloat(payTarget.balance);
    if (amount > balance) { notifyError(`Amount exceeds balance (৳${balance.toLocaleString()})`); return; }
    // Build external reference key: METHOD:REFERENCE:NOTE
    const refParts = [payMethod];
    if (payReference) refParts.push(payReference);
    if (payNote) refParts.push(payNote);
    const transactionExternalKey = refParts.join(':');
    try {
      setPaying(true);
      const res = await payInvoice(payTarget.invoiceId, id, amount, {
        currency: payTarget.currency || 'BDT',
        transactionExternalKey,
      });
      success(`Payment of ৳${amount.toLocaleString()} recorded${amount < balance ? ' (partial)' : ''}`);
      setPayDialogOpen(false);
      // Save attachments
      const paymentId = res.headers?.location?.split('/').pop();
      if (paymentId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await saveAttachment(paymentId, file);
        }
      }
      if (paymentId) {
        try {
          const [payRes, invRes] = await Promise.all([
            getPayment(paymentId),
            getInvoice(payTarget.invoiceId),
          ]);
          setReceiptPayment(payRes.data);
          setReceiptInvoice(invRes.data);
          setReceiptOpen(true);
        } catch { /* receipt fetch failed, not critical */ }
      }
      loadData();
    } catch (e) {
      const { message, detail } = extractError(e, 'Payment failed');
      notifyError(message, detail);
    } finally {
      setPaying(false);
    }
  };

  // View receipt for existing payment
  const viewReceipt = async (p) => {
    try {
      const payRes = await getPayment(p.paymentId);
      setReceiptPayment(payRes.data);
      // Try to find associated invoice
      const targetInvoice = invoices.find(inv =>
        (inv.items || []).some(item => item.linkedInvoicePaymentId)
      );
      setReceiptInvoice(targetInvoice || null);
      setReceiptOpen(true);
    } catch {
      notifyError('Failed to load receipt');
    }
  };

  const handlePrintReceipt = () => {
    const printContent = document.getElementById('payment-receipt-print');
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title>
      <style>body{font-family:Inter,Arial,sans-serif;margin:0;padding:20px}
      table{width:100%;border-collapse:collapse}td{padding:4px 8px;vertical-align:top}
      .header{text-align:center;margin-bottom:20px}.amount{text-align:center;background:#f8faf8;padding:16px;border-radius:4px;margin:16px 0}
      hr{border:none;border-top:1px solid #e5e7eb;margin:12px 0}
      @media print{body{padding:0}}</style></head><body>`);
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  // Purchase flow
  const handleSelectPlan = (planName) => { setSelectedPlan(planName); setPurchaseStep(1); };
  const handleConfirmPurchase = async () => {
    if (!selectedPlan) return;
    const plan = allPlans[selectedPlan];
    try {
      setSaving(true);
      await createSubscription({
        accountId: id,
        productName: getProductName(selectedPlan),
        productCategory: plan.category === 'Add-on' ? 'ADD_ON' : 'BASE',
        billingPeriod: 'MONTHLY',
        priceList: 'DEFAULT',
      });
      success(`Subscribed to ${plan.displayName}`);
      setPurchaseStep(2);
      loadData();
    } catch (e) {
      const { message, detail } = extractError(e, 'Failed to create subscription');
      notifyError(message, detail);
    } finally { setSaving(false); }
  };
  const closePurchase = () => { setPurchaseOpen(false); setPurchaseStep(0); setSelectedPlan(null); };

  const handleAction = async (action, subId) => {
    try {
      if (action === 'cancel') await cancelSubscription(subId);
      else if (action === 'pause') await pauseSubscription(subId);
      else if (action === 'resume') await resumeSubscription(subId);
      success(`Subscription ${action}ed`);
      loadData();
    } catch (e) { const { message, detail } = extractError(e, `Failed to ${action}`); notifyError(message, detail); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!account) return <Alert severity="error">Customer not found</Alert>;

  const planFeatures = selectedPlan ? allPlans[selectedPlan] : null;

  // Compute AR summary for this customer
  const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + parseFloat(i.balance || 0), 0);
  const totalPaid = totalInvoiced - totalBalance;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/customers')} sx={{ mb: 2 }}>Back to Customers</Button>

      {/* Account Info + AR Summary */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h6">{account.name}</Typography>
              <Typography variant="body2" color="text.secondary">{account.externalKey}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {overdue && <StatusChip status={overdue.name || 'ACTIVE'} />}
              <Chip label={account.currency} size="small" variant="outlined" />
            </Box>
          </Box>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Email</Typography>
              <Typography variant="body2">{account.email || '-'}</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Phone</Typography>
              <Typography variant="body2">{account.phone || '-'}</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Company</Typography>
              <Typography variant="body2">{account.company || '-'}</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Total Invoiced</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>৳{totalInvoiced.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Total Paid</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32' }}>৳{totalPaid.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" color="text.secondary">Outstanding</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: totalBalance > 0 ? '#c62828' : '#2e7d32' }}>
                ৳{totalBalance.toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #e5e7eb', px: 2 }}>
          <Tab label={`Subscriptions (${allSubscriptions.length})`} />
          <Tab label={`Invoices (${invoices.filter(i => parseFloat(i.amount) > 0).length})`} />
          <Tab label={`Payments (${payments.length})`} />
        </Tabs>

        {/* Subscriptions Tab */}
        {tab === 0 && (
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<ShoppingCart />} onClick={() => setPurchaseOpen(true)}>
                Purchase Subscription
              </Button>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Features</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>Charged Through</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allSubscriptions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No subscriptions</TableCell></TableRow>
                ) : allSubscriptions.map((sub) => {
                  const pf = getPlanFeatures(sub.planName);
                  return (
                    <TableRow key={sub.subscriptionId} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{pf?.displayName || sub.productName}</TableCell>
                      <TableCell>
                        {pf && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {Object.entries(pf.features).slice(0, 3).map(([k, v]) => (
                              <Chip key={k} label={`${getFeatureLabel(k)}: ${v}`} size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#f0f4f8' }} />
                            ))}
                            {Object.keys(pf.features).length > 3 && (
                              <Chip label={`+${Object.keys(pf.features).length - 3}`} size="small" sx={{ fontSize: 10, height: 20 }} variant="outlined" />
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{sub.billingPeriod}</TableCell>
                      <TableCell><StatusChip status={sub.state} /></TableCell>
                      <TableCell>{dayjs(sub.startDate).format('YYYY-MM-DD')}</TableCell>
                      <TableCell>{sub.chargedThroughDate ? dayjs(sub.chargedThroughDate).format('YYYY-MM-DD') : '-'}</TableCell>
                      <TableCell align="right">
                        {sub.state === 'ACTIVE' && (
                          <>
                            <Tooltip title="Pause"><IconButton size="small" onClick={() => handleAction('pause', sub.subscriptionId)}><Pause fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Cancel"><IconButton size="small" color="error" onClick={() => handleAction('cancel', sub.subscriptionId)}><Cancel fontSize="small" /></IconButton></Tooltip>
                          </>
                        )}
                        {sub.state === 'BLOCKED' && (
                          <Tooltip title="Resume"><IconButton size="small" color="primary" onClick={() => handleAction('resume', sub.subscriptionId)}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}

        {/* Invoices Tab */}
        {tab === 1 && (
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
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
                {invoices.filter(inv => parseFloat(inv.amount || 0) > 0).map((inv) => {
                  const amount = parseFloat(inv.amount || 0);
                  const balance = parseFloat(inv.balance || 0);
                  const paid = amount - balance;
                  const isPartial = paid > 0 && balance > 0;
                  return (
                    <TableRow key={inv.invoiceId} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNumber}</TableCell>
                      <TableCell>{dayjs(inv.invoiceDate).format('YYYY-MM-DD')}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(inv.items || []).map((item, i) => {
                            const pf = getPlanFeatures(item.planName);
                            return <Chip key={i} size="small" label={`${pf?.displayName || item.planName}: ৳${parseFloat(item.amount).toLocaleString()}`} sx={{ fontSize: 11, height: 22 }} />;
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
          </CardContent>
        )}

        {/* Payments Tab */}
        {tab === 2 && (
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Payment #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Method / Ref</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Receipt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No payments recorded</TableCell></TableRow>
                ) : payments.map((p) => {
                  const txn = p.transactions?.[0];
                  const refKey = txn?.transactionExternalKey || '';
                  const refParts = refKey.split(':');
                  const method = PAYMENT_METHODS.find(m => m.value === refParts[0])?.label || refParts[0] || '-';
                  const ref = refParts[1] || '';
                  return (
                    <TableRow key={p.paymentId} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.paymentNumber || p.paymentId?.slice(0, 12)}</TableCell>
                      <TableCell>{dayjs(txn?.effectiveDate || p.effectiveDate || p.auditLogs?.[0]?.changeDate).format('YYYY-MM-DD HH:mm')}</TableCell>
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
          </CardContent>
        )}
      </Card>

      {/* Payment Dialog — supports partial payment */}
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
                    <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                    <Typography variant="body2">৳{parseFloat(payTarget.amount).toLocaleString()}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Outstanding Balance</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#c62828' }}>
                      ৳{parseFloat(payTarget.balance).toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
                {/* Items breakdown */}
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

              {/* Previous payments on this invoice */}
              {invoicePayments[payTarget.invoiceId]?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <History sx={{ fontSize: 14 }} /> Previous Payments
                  </Typography>
                  {invoicePayments[payTarget.invoiceId].map((p, i) => (
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
                    fullWidth size="small" label="Payment Amount (BDT)" type="number"
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
                  <TextField
                    fullWidth size="small" label="Payment Method" select
                    value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" label="Reference / TrxID"
                    value={payReference} onChange={(e) => setPayReference(e.target.value)}
                    placeholder="Bank ref, bKash TrxID, cheque #"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" label="Note (optional)"
                    value={payNote} onChange={(e) => setPayNote(e.target.value)}
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button size="small" variant="outlined" onClick={() => setPayAmount(payTarget.balance.toString())}>
                  Full (৳{parseFloat(payTarget.balance).toLocaleString()})
                </Button>
                <Button size="small" variant="outlined" onClick={() => setPayAmount((parseFloat(payTarget.balance) / 2).toFixed(2))}>
                  Half (৳{(parseFloat(payTarget.balance) / 2).toLocaleString()})
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
                          <IconButton size="small" color="error" onClick={() => {
                            deleteAttachment(attachKey, att.id);
                            setAttachFiles(getAttachments(attachKey));
                          }}>
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
          <Box id="payment-receipt-print">
            <PaymentReceipt
              payment={receiptPayment}
              invoice={receiptInvoice}
              account={account}
              planLabel={(planName) => getPlanFeatures(planName)?.displayName || planName}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReceiptOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Purchase Dialog — unchanged */}
      <Dialog open={purchaseOpen} onClose={closePurchase} maxWidth="md" fullWidth>
        <DialogTitle>Purchase Subscription for {account.name}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={purchaseStep} sx={{ my: 2 }}>
            <Step><StepLabel>Select Plan</StepLabel></Step>
            <Step><StepLabel>Review & Confirm</StepLabel></Step>
            <Step><StepLabel>Done</StepLabel></Step>
          </Stepper>
          {purchaseStep === 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {planKeys.map((planName) => {
                const plan = allPlans[planName];
                const alreadySubscribed = allSubscriptions.some(s => s.planName === planName && (s.state === 'ACTIVE' || s.state === 'BLOCKED'));
                return (
                  <Grid item xs={12} sm={6} md={4} key={planName}>
                    <Card sx={{ height: '100%', cursor: alreadySubscribed ? 'default' : 'pointer', opacity: alreadySubscribed ? 0.5 : 1, border: selectedPlan === planName ? '2px solid #00A651' : '1px solid #e5e7eb', '&:hover': alreadySubscribed ? {} : { borderColor: '#00A651' }, transition: 'all 0.2s' }}
                      onClick={() => !alreadySubscribed && handleSelectPlan(planName)}>
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{plan.displayName}</Typography>
                          <Chip label={plan.category} size="small" sx={{ fontSize: 10, height: 20 }} />
                        </Box>
                        <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                          ৳{plan.price.toLocaleString()}<Typography component="span" variant="caption" color="text.secondary">/month</Typography>
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        {Object.entries(plan.features).map(([key, val]) => (
                          <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                            <Typography variant="caption" color="text.secondary">{getFeatureLabel(key)}</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 500 }}>{val}</Typography>
                          </Box>
                        ))}
                        {alreadySubscribed && <Chip label="Subscribed" size="small" sx={{ mt: 1, fontSize: 10 }} />}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
          {purchaseStep === 1 && planFeatures && (
            <Card sx={{ bgcolor: '#f8faf8', border: '1px solid #e8f5e9', mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Order Summary</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Plan</Typography><Typography variant="body1" sx={{ fontWeight: 500 }}>{planFeatures.displayName}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Monthly Price</Typography><Typography variant="h6" color="primary">৳{planFeatures.price.toLocaleString()}</Typography></Grid>
                </Grid>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Service Features</Typography>
                <Grid container spacing={1}>
                  {Object.entries(planFeatures.features).map(([key, val]) => (
                    <Grid item xs={6} key={key}><Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3, px: 1, bgcolor: '#fff', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">{getFeatureLabel(key)}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{val}</Typography>
                    </Box></Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}
          {purchaseStep === 2 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 48, color: '#28c76f', mb: 1 }} />
              <Typography variant="h6">Subscription Created</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {planFeatures?.displayName} activated. Invoice generated — record payment when received.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {purchaseStep === 0 && <Button onClick={closePurchase}>Cancel</Button>}
          {purchaseStep === 1 && (<>
            <Button onClick={() => { setPurchaseStep(0); setSelectedPlan(null); }}>Back</Button>
            <Button variant="contained" onClick={handleConfirmPurchase} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : <ShoppingCart />}>
              {saving ? 'Creating...' : `Confirm — ৳${planFeatures?.price.toLocaleString()}/mo`}
            </Button>
          </>)}
          {purchaseStep === 2 && <Button variant="contained" onClick={closePurchase}>Done</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
