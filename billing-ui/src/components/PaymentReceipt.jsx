import { forwardRef } from 'react';
import { Box, Typography, Divider, Grid, Table, TableBody, TableRow, TableCell } from '@mui/material';
import dayjs from 'dayjs';

// Printable payment receipt — pass ref for window.print()
const PaymentReceipt = forwardRef(function PaymentReceipt({ payment, invoice, account, planLabel }, ref) {
  if (!payment) return null;

  const txn = payment.transactions?.[0] || {};
  const amount = parseFloat(txn.amount || payment.purchasedAmount || 0);
  const currency = txn.currency || payment.currency || 'BDT';
  const refKey = txn.transactionExternalKey || payment.paymentExternalKey || '-';
  const paymentDate = txn.effectiveDate || payment.effectiveDate;
  const invoiceAmount = invoice ? parseFloat(invoice.amount || 0) : null;
  const invoiceBalance = invoice ? parseFloat(invoice.balance || 0) : null;

  return (
    <Box ref={ref} sx={{ p: 4, maxWidth: 600, mx: 'auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#00A651', mb: 0.5 }}>
          Telcobright Billing
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Payment Receipt</Typography>
        <Typography variant="caption" color="text.secondary">
          Receipt #{txn.transactionId?.slice(0, 8).toUpperCase() || payment.paymentId?.slice(0, 8).toUpperCase()}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Payment Details */}
      <Table size="small" sx={{ mb: 2, '& td': { borderBottom: 'none', py: 0.5, px: 1 } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, width: 180, color: 'text.secondary' }}>Payment Date</TableCell>
            <TableCell>{paymentDate ? dayjs(paymentDate).format('YYYY-MM-DD HH:mm:ss') : '-'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Payment ID</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.paymentId || '-'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Transaction ID</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{txn.transactionId || '-'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>External Reference</TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{refKey !== '-' ? refKey : 'N/A'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Payment Method</TableCell>
            <TableCell>{txn.paymentExternalKey ? 'Gateway' : 'Manual / External'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, color: txn.status === 'SUCCESS' ? '#2e7d32' : '#c62828' }}>
              {txn.status || 'UNKNOWN'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Divider sx={{ mb: 2 }} />

      {/* Customer */}
      {account && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Customer</Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Name</Typography>
              <Typography variant="body2">{account.name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Account Key</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{account.externalKey || '-'}</Typography>
            </Grid>
            {account.company && (
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Company</Typography>
                <Typography variant="body2">{account.company}</Typography>
              </Grid>
            )}
            {account.email && (
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Email</Typography>
                <Typography variant="body2">{account.email}</Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Invoice Details */}
      {invoice && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Invoice</Typography>
          <Table size="small" sx={{ '& td': { borderBottom: 'none', py: 0.3, px: 1 } }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 500, width: 180, color: 'text.secondary' }}>Invoice #</TableCell>
                <TableCell>{invoice.invoiceNumber}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Invoice Date</TableCell>
                <TableCell>{dayjs(invoice.invoiceDate).format('YYYY-MM-DD')}</TableCell>
              </TableRow>
              {(invoice.items || []).map((item, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>{i === 0 ? 'Items' : ''}</TableCell>
                  <TableCell>{planLabel?.(item.planName) || item.planName} — {currency} {parseFloat(item.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Invoice Total</TableCell>
                <TableCell>{currency} {invoiceAmount?.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>Remaining Balance</TableCell>
                <TableCell sx={{ fontWeight: 600, color: invoiceBalance > 0 ? '#c62828' : '#2e7d32' }}>
                  {currency} {invoiceBalance?.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Amount */}
      <Box sx={{ bgcolor: '#f8faf8', borderRadius: 1, p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#00A651' }}>
          {currency} {amount.toLocaleString()}
        </Typography>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="caption" color="text.secondary">
          This is a system-generated receipt. For queries contact billing@telcobright.com
        </Typography>
      </Box>
    </Box>
  );
});

export default PaymentReceipt;
