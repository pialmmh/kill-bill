import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#00A651', light: '#4dc97a', dark: '#007a3b' },
    secondary: { main: '#2B5A8A', light: '#5a8ab8', dark: '#1a3d5c' },
    success: { main: '#28c76f' },
    warning: { main: '#ff9f43' },
    error: { main: '#c9302c' },
    info: { main: '#7CB518' },
    background: { default: '#f5f6fa', paper: '#ffffff' },
    text: { primary: '#2c2c2c', secondary: '#626262' },
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: 6 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e9ecef' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { '& .MuiTableCell-head': { fontWeight: 600, backgroundColor: '#f8f9fa', color: '#2c2c2c' } },
      },
    },
  },
});

export default theme;
