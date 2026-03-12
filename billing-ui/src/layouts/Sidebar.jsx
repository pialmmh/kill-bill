import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Box, Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Subscriptions as SubIcon,
  Receipt as InvoiceIcon,
  Inventory as CatalogIcon,
  Business as TenantIcon,
  Assessment as ARIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 240;

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuper } = useAuth();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Customers', icon: <PeopleIcon />, path: '/customers' },
    { text: 'Subscriptions', icon: <SubIcon />, path: '/subscriptions' },
    { text: 'Invoices', icon: <InvoiceIcon />, path: '/invoices' },
    { text: 'Payments', icon: <PaymentsIcon />, path: '/payments' },
    { text: 'Catalog', icon: <CatalogIcon />, path: '/catalog' },
    { text: 'AR Report', icon: <ARIcon />, path: '/reports/ar' },
  ];

  // Super admin gets tenant management
  if (isSuper) {
    menuItems.push({ text: 'Tenants', icon: <TenantIcon />, path: '/tenants' });
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#fff',
          borderRight: '1px solid #e5e7eb',
        },
      }}
    >
      <Toolbar sx={{ px: 2, gap: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '8px',
            bgcolor: 'primary.main', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>TB</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Telcobright
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            Billing System
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, pt: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => navigate(item.path)}
            selected={isActive(item.path)}
            sx={{
              borderRadius: '6px', mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'rgba(0,166,81,0.08)',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
              '&:hover': { bgcolor: 'rgba(0,166,81,0.04)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? 'primary.main' : '#6b7280' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{ fontSize: 14, fontWeight: isActive(item.path) ? 600 : 400 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
