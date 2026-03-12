import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box,
  Table, TableHead, TableRow, TableCell, TableBody,
  Button, CircularProgress, Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
  Subscriptions as SubIcon,
  Receipt as InvoiceIcon,
  AccountBalance as BalanceIcon,
} from '@mui/icons-material';
import StatCard from '../components/StatCard';
import StatusChip from '../components/StatusChip';
import { getAccounts, getAccountBundles, getAccountInvoices } from '../services/killbill';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ customers: 0, subscriptions: 0, invoices: 0, revenue: 0 });
  const [recentAccounts, setRecentAccounts] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const accountsRes = await getAccounts(0, 100);
      const accounts = accountsRes.data || [];
      setRecentAccounts(accounts.slice(0, 10));

      let totalSubs = 0;
      let totalInvoices = 0;
      let totalRevenue = 0;

      for (const acc of accounts) {
        try {
          const [bundlesRes, invoicesRes] = await Promise.all([
            getAccountBundles(acc.accountId),
            getAccountInvoices(acc.accountId),
          ]);
          const subs = (bundlesRes.data || []).reduce(
            (sum, b) => sum + (b.subscriptions?.length || 0), 0
          );
          totalSubs += subs;
          const invoices = invoicesRes.data || [];
          totalInvoices += invoices.length;
          totalRevenue += invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
        } catch (e) { /* skip individual account errors */ }
      }

      setStats({
        customers: accounts.length,
        subscriptions: totalSubs,
        invoices: totalInvoices,
        revenue: totalRevenue,
      });
    } catch (e) {
      setError(e.response?.status === 401 ? 'Kill Bill authentication failed' :
        e.message?.includes('Network') ? 'Kill Bill server not reachable on port 18080' : e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Customers" value={stats.customers} icon={<PeopleIcon />} color="#2B5A8A" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Subscriptions" value={stats.subscriptions} icon={<SubIcon />} color="#00A651" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Invoices" value={stats.invoices} icon={<InvoiceIcon />} color="#ff9f43" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Revenue (BDT)"
            value={`৳${stats.revenue.toLocaleString()}`}
            icon={<BalanceIcon />}
            color="#7CB518"
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">Recent Customers</Typography>
            <Button size="small" onClick={() => navigate('/customers')}>View All</Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No customers yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                recentAccounts.map((acc) => (
                  <TableRow
                    key={acc.accountId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/customers/${acc.accountId}`)}
                  >
                    <TableCell>{acc.name || '-'}</TableCell>
                    <TableCell>{acc.email || '-'}</TableCell>
                    <TableCell>{acc.phone || '-'}</TableCell>
                    <TableCell>{acc.currency}</TableCell>
                    <TableCell>৳{parseFloat(acc.accountBalance || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
