import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography,
  Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress,
} from '@mui/material';
import StatusChip from '../components/StatusChip';
import { getAccounts, getAccountBundles } from '../services/killbill';
import dayjs from 'dayjs';

export default function Subscriptions() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const accRes = await getAccounts(0, 200);
        const accounts = accRes.data || [];
        const allSubs = [];
        for (const acc of accounts) {
          try {
            const res = await getAccountBundles(acc.accountId);
            (res.data || []).forEach(b =>
              (b.subscriptions || []).forEach(s =>
                allSubs.push({ ...s, accountName: acc.name, accountId: acc.accountId, accountKey: acc.externalKey })
              )
            );
          } catch (e) { /* skip */ }
        }
        setSubs(allSubs);
      } catch (e) { /* */ }
      setLoading(false);
    })();
  }, []);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>All Subscriptions</Typography>
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Start Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No subscriptions</TableCell>
                  </TableRow>
                ) : (
                  subs.map((s) => (
                    <TableRow key={s.subscriptionId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${s.accountId}`)}>
                      <TableCell>{s.accountName || s.accountKey}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{s.productName}</TableCell>
                      <TableCell>{s.planName}</TableCell>
                      <TableCell>{s.billingPeriod}</TableCell>
                      <TableCell><StatusChip status={s.state} /></TableCell>
                      <TableCell>{dayjs(s.startDate).format('YYYY-MM-DD')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
