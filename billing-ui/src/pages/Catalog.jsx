import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Divider,
  CircularProgress, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { getCatalog } from '../services/killbill';
import { getAllPlans, getFeatureLabel } from '../services/planFeatures';

export default function Catalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await getCatalog();
        setCatalog(res.data?.[0] || null);
      } catch (e) {
        setError('Failed to load catalog.');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!catalog) return <Alert severity="info">No catalog configured.</Alert>;

  const allPlanFeatures = getAllPlans();
  const categories = ['all', ...new Set(Object.values(allPlanFeatures).map(p => p.category))];

  const filteredPlans = Object.entries(allPlanFeatures).filter(([_, plan]) =>
    filter === 'all' || plan.category === filter
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Service Catalog</Typography>
          <Typography variant="body2" color="text.secondary">
            {catalog.name} &middot; {Object.keys(allPlanFeatures).length} plans
          </Typography>
        </Box>
        <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
          {categories.map(c => (
            <ToggleButton key={c} value={c} sx={{ textTransform: 'none', px: 2 }}>
              {c === 'all' ? 'All' : c}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={2}>
        {filteredPlans.map(([planName, plan]) => {
          const categoryColor = {
            Internet: { bg: '#e3f2fd', color: '#1565c0' },
            Telecom: { bg: '#f3e5f5', color: '#7b1fa2' },
            Messaging: { bg: '#fff3e0', color: '#e65100' },
            'Add-on': { bg: '#f5f5f5', color: '#616161' },
          }[plan.category] || { bg: '#f5f5f5', color: '#616161' };

          return (
            <Grid item xs={12} sm={6} md={4} key={planName}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{plan.displayName}</Typography>
                    <Chip label={plan.category} size="small"
                      sx={{ bgcolor: categoryColor.bg, color: categoryColor.color, fontWeight: 500, fontSize: 11 }} />
                  </Box>
                  <Typography variant="h5" color="primary" sx={{ mb: 0.5 }}>
                    ৳{plan.price.toLocaleString()}
                    <Typography component="span" variant="body2" color="text.secondary"> /month</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {planName}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  {Object.entries(plan.features).map(([key, val]) => (
                    <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                      <Typography variant="body2" color="text.secondary">{getFeatureLabel(key)}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{val}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
