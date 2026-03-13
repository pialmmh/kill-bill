import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './components/ErrorNotification';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Subscriptions from './pages/Subscriptions';
import Invoices from './pages/Invoices';
import Catalog from './pages/Catalog';
import Tenants from './pages/Tenants';
import ARReport from './pages/ARReport';
import Payments from './pages/Payments';

function ProtectedRoutes() {
  const { isLoggedIn, isSuper } = useAuth();

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/reports/ar" element={<ARReport />} />
        {isSuper && <Route path="/tenants" element={<Tenants />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
