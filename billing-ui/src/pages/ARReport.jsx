import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel,
  CircularProgress, TextField, InputAdornment, LinearProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { getAccounts, getAccountInvoicesList, getAccountPayments } from '../services/killbill';
import { useNotification } from '../components/ErrorNotification';

export default function ARReport() {
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('outstanding');
  const [orderDir, setOrderDir] = useState('desc');

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const acctRes = await getAccounts(0, 500);
      const accounts = acctRes.data || [];

      // Fetch invoices + payments for each account in parallel
      const enriched = await Promise.all(
        accounts.map(async (acc) => {
          try {
            const [invRes, payRes] = await Promise.all([
              getAccountInvoicesList(acc.accountId),
              getAccountPayments(acc.accountId),
            ]);
            const invoices = invRes.data || [];
            const payments = payRes.data || [];

            const totalInvoiced = invoices.reduce(
              (sum, inv) => sum + parseFloat(inv.amount || 0), 0
            );
            const totalPaid = payments
              .filter(p => p.transactions?.some(t => t.transactionType === 'PURCHASE' && t.status === 'SUCCESS'))
              .reduce((sum, p) => {
                const successTxns = (p.transactions || []).filter(
                  t => t.transactionType === 'PURCHASE' && t.status === 'SUCCESS'
                );
                return sum + successTxns.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
              }, 0);

            const outstanding = totalInvoiced - totalPaid;

            // Find oldest unpaid invoice
            const unpaidInvoices = invoices.filter(inv => parseFloat(inv.balance || 0) > 0);
            unpaidInvoices.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));
            const oldestUnpaid = unpaidInvoices[0]?.invoiceDate || null;

            // Days overdue from oldest unpaid
            const daysOverdue = oldestUnpaid
              ? Math.max(0, Math.floor((Date.now() - new Date(oldestUnpaid)) / 86400000))
              : 0;

            return {
              accountId: acc.accountId,
              name: acc.name || '-',
              externalKey: acc.externalKey || '-',
              company: acc.company || '-',
              totalInvoiced,
              totalPaid,
              outstanding,
              invoiceCount: invoices.length,
              oldestUnpaid,
              daysOverdue,
            };
          } catch {
            return {
              accountId: acc.accountId,
              name: acc.name || '-',
              externalKey: acc.externalKey || '-',
              company: acc.company || '-',
              totalInvoiced: 0, totalPaid: 0, outstanding: 0,
              invoiceCount: 0, oldestUnpaid: null, daysOverdue: 0,
            };
          }
        })
      );

      setRows(enriched);
    } catch (e) {
      notifyError('Failed to load AR report');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (orderBy === field) {
      setOrderDir(orderDir === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(field);
      setOrderDir('desc');
    }
  };

  const filtered = rows
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q)
        || r.externalKey.toLowerCase().includes(q)
        || r.company.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const mul = orderDir === 'asc' ? 1 : -1;
      if (typeof a[orderBy] === 'string') return mul * a[orderBy].localeCompare(b[orderBy]);
      return mul * ((a[orderBy] || 0) - (b[orderBy] || 0));
    });

  // Summary totals
  const totals = filtered.reduce(
    (acc, r) => ({
      invoiced: acc.invoiced + r.totalInvoiced,
      paid: acc.paid + r.totalPaid,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { invoiced: 0, paid: 0, outstanding: 0 }
  );

  const fmt = (v) => `৳${parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const statusChip = (row) => {
    if (row.outstanding <= 0) return <Chip label="Paid" size="small" color="success" variant="outlined" />;
    if (row.daysOverdue > 30) return <Chip label="Overdue 30+" size="small" color="error" />;
    if (row.daysOverdue > 14) return <Chip label="Overdue 14+" size="small" color="warning" />;
    if (row.daysOverdue > 7) return <Chip label="Overdue 7+" size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100' }} />;
    if (row.outstanding > 0) return <Chip label="Due" size="small" color="info" variant="outlined" />;
    return null;
  };

  const collectionRate = totals.invoiced > 0 ? (totals.paid / totals.invoiced) * 100 : 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Accounts Receivable Report</Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        <Card>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Total Invoiced</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{fmt(totals.invoiced)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Total Collected</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt(totals.paid)}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Outstanding</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: totals.outstanding > 0 ? 'error.main' : 'text.primary' }}>
              {fmt(totals.outstanding)}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Collection Rate</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{collectionRate.toFixed(1)}%</Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(collectionRate, 100)}
              sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
            />
          </CardContent>
        </Card>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name, key or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
          }}
        />
      </Box>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel active={orderBy === 'externalKey'} direction={orderBy === 'externalKey' ? orderDir : 'asc'} onClick={() => handleSort('externalKey')}>
                      Key
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? orderDir : 'asc'} onClick={() => handleSort('name')}>
                      Customer
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell align="center">Invoices</TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={orderBy === 'totalInvoiced'} direction={orderBy === 'totalInvoiced' ? orderDir : 'asc'} onClick={() => handleSort('totalInvoiced')}>
                      Invoiced
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={orderBy === 'totalPaid'} direction={orderBy === 'totalPaid' ? orderDir : 'asc'} onClick={() => handleSort('totalPaid')}>
                      Paid
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={orderBy === 'outstanding'} direction={orderBy === 'outstanding' ? orderDir : 'asc'} onClick={() => handleSort('outstanding')}>
                      Outstanding
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel active={orderBy === 'daysOverdue'} direction={orderBy === 'daysOverdue' ? orderDir : 'asc'} onClick={() => handleSort('daysOverdue')}>
                      Days Overdue
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow
                      key={row.accountId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/customers/${row.accountId}`)}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.externalKey}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.company}</TableCell>
                      <TableCell align="center">{row.invoiceCount}</TableCell>
                      <TableCell align="right">{fmt(row.totalInvoiced)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(row.totalPaid)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: row.outstanding > 0 ? 'error.main' : 'text.primary' }}>
                        {fmt(row.outstanding)}
                      </TableCell>
                      <TableCell align="right">{row.daysOverdue > 0 ? row.daysOverdue : '-'}</TableCell>
                      <TableCell align="center">{statusChip(row)}</TableCell>
                    </TableRow>
                  ))
                )}
                {/* Totals row */}
                {filtered.length > 0 && (
                  <TableRow sx={{ bgcolor: '#f9fafb', '& td': { fontWeight: 700, borderTop: '2px solid #e5e7eb' } }}>
                    <TableCell colSpan={4} align="right">Totals</TableCell>
                    <TableCell align="right">{fmt(totals.invoiced)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(totals.paid)}</TableCell>
                    <TableCell align="right" sx={{ color: totals.outstanding > 0 ? 'error.main' : 'text.primary' }}>
                      {fmt(totals.outstanding)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
