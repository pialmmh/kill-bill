import { Box, Toolbar } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import TopBar from './TopBar';
import TenantGuard from '../components/TenantGuard';

// Pages that need a tenant selected
const TENANT_REQUIRED_PATHS = ['/', '/customers', '/subscriptions', '/invoices', '/payments', '/catalog', '/reports'];

export default function MainLayout() {
  const location = useLocation();
  const needsTenant = TENANT_REQUIRED_PATHS.some(p =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  ) && !location.pathname.startsWith('/tenants');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f6fa' }}>
      <Sidebar />
      <TopBar />
      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: 0 }}>
        <Toolbar />
        {needsTenant ? <TenantGuard><Outlet /></TenantGuard> : <Outlet />}
      </Box>
    </Box>
  );
}
