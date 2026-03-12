import { Box, Alert, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TenantGuard({ children }) {
  const { activeTenant, isSuper } = useAuth();
  const navigate = useNavigate();

  if (!activeTenant) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          No Tenant Selected
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a tenant from the dropdown above to view billing data.
        </Typography>
        {isSuper && (
          <Button variant="outlined" onClick={() => navigate('/tenants')}>
            Manage Tenants
          </Button>
        )}
      </Box>
    );
  }

  return children;
}
