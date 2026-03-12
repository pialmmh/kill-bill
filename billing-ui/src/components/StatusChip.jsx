import { Chip } from '@mui/material';

const statusColors = {
  // Subscription states
  ACTIVE: { bg: '#e8f5e9', color: '#2e7d32' },
  PENDING: { bg: '#fff3e0', color: '#e65100' },
  BLOCKED: { bg: '#fce4ec', color: '#c62828' },
  CANCELLED: { bg: '#f5f5f5', color: '#616161' },
  PAUSED: { bg: '#e3f2fd', color: '#1565c0' },
  // Invoice states
  COMMITTED: { bg: '#e8f5e9', color: '#2e7d32' },
  DRAFT: { bg: '#fff3e0', color: '#e65100' },
  VOID: { bg: '#f5f5f5', color: '#616161' },
  // Payment states
  SUCCESS: { bg: '#e8f5e9', color: '#2e7d32' },
  FAILED: { bg: '#fce4ec', color: '#c62828' },
  // Overdue states
  WARNING: { bg: '#fff3e0', color: '#e65100' },
  SUSPENDED: { bg: '#fce4ec', color: '#c62828' },
  DISCONNECTED: { bg: '#f5f5f5', color: '#616161' },
  __KILLBILL__CLEAR__OVERDUE_STATE__: { bg: '#e8f5e9', color: '#2e7d32' },
};

export default function StatusChip({ status }) {
  const label = status === '__KILLBILL__CLEAR__OVERDUE_STATE__' ? 'GOOD' : status;
  const colors = statusColors[status] || { bg: '#f5f5f5', color: '#616161' };
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: colors.bg, color: colors.color, fontWeight: 600, fontSize: 11 }}
    />
  );
}
