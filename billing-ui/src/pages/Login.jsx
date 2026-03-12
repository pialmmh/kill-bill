import { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = login(username, password);
    if (!result) {
      setError('Invalid credentials');
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#f5f6fa',
    }}>
      <Card sx={{ width: 380, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '12px', bgcolor: 'primary.main',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
            }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>TB</Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Telcobright Billing</Typography>
            <Typography variant="body2" color="text.secondary">Sign in to your account</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth size="small" label="Username" value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2 }}
              autoFocus
            />
            <TextField
              fullWidth size="small" label="Password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2.5 }}
            />
            <Button fullWidth variant="contained" type="submit" sx={{ py: 1 }}>
              Sign In
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
            Super Admin: admin / password
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
