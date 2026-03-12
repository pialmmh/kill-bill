import {
  AppBar, Toolbar, Typography, Chip, Box, MenuItem,
  Select, Button, Divider,
} from '@mui/material';
import { Logout, Warning } from '@mui/icons-material';
import { DRAWER_WIDTH } from './Sidebar';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { auth, activeTenant, isSuper, availableTenants, switchTenant, logout } = useAuth();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        ml: `${DRAWER_WIDTH}px`,
        bgcolor: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box>
          {!activeTenant && isSuper && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning sx={{ fontSize: 18, color: '#ff9f43' }} />
              <Typography variant="body2" color="text.secondary">
                Select a tenant to manage billing data
              </Typography>
            </Box>
          )}
          {activeTenant && (
            <Typography variant="body2" color="text.secondary">
              Tenant: <strong>{activeTenant.name}</strong>
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Tenant Selector — super admin can switch, tenant admin sees their own */}
          {availableTenants.length > 0 && (
            <Select
              size="small"
              value={activeTenant?.apiKey || ''}
              onChange={(e) => {
                const tenant = availableTenants.find(t => t.apiKey === e.target.value);
                if (tenant) switchTenant(tenant);
              }}
              displayEmpty
              sx={{ minWidth: 180, fontSize: 13, height: 34 }}
              disabled={!isSuper}
            >
              {isSuper && <MenuItem value="" disabled><em>Select tenant...</em></MenuItem>}
              {availableTenants.map((t) => (
                <MenuItem key={t.apiKey} value={t.apiKey} sx={{ fontSize: 13 }}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          )}

          <Divider orientation="vertical" flexItem />

          {/* User info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={isSuper ? 'Super Admin' : 'Tenant Admin'}
              size="small"
              sx={{
                bgcolor: isSuper ? '#f3e5f5' : '#e8f5e9',
                color: isSuper ? '#7b1fa2' : '#2e7d32',
                fontWeight: 500, fontSize: 11,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {auth?.username}
            </Typography>
            <Button size="small" startIcon={<Logout sx={{ fontSize: 16 }} />} onClick={logout}
              sx={{ ml: 0.5, fontSize: 12, color: 'text.secondary' }}>
              Logout
            </Button>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
