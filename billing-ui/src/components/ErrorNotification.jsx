import { useState, createContext, useContext, useCallback } from 'react';
import { Snackbar, Alert, IconButton, Box, Typography, Collapse } from '@mui/material';
import { ContentCopy, ExpandMore, ExpandLess, Close } from '@mui/icons-material';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState('error');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const notify = useCallback(({ severity: sev = 'error', message: msg, detail: det = '' }) => {
    setSeverity(sev);
    setMessage(msg);
    setDetail(det);
    setExpanded(false);
    setCopied(false);
    setOpen(true);
  }, []);

  const success = useCallback((msg) => notify({ severity: 'success', message: msg }), [notify]);
  const error = useCallback((msg, det) => notify({ severity: 'error', message: msg, detail: det }), [notify]);
  const warn = useCallback((msg) => notify({ severity: 'warning', message: msg }), [notify]);

  const handleCopy = async () => {
    const text = detail ? `${message}\n\n${detail}` : message;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const el = document.getElementById('notif-text');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }
  };

  const duration = severity === 'error' ? null : 4000; // errors stay until dismissed

  return (
    <NotificationContext.Provider value={{ notify, success, error, warn }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={duration}
        onClose={(_, reason) => { if (reason !== 'clickaway') setOpen(false); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ maxWidth: 520, mt: 1 }}
      >
        <Alert
          severity={severity}
          variant="filled"
          sx={{
            width: '100%',
            alignItems: 'flex-start',
            '& .MuiAlert-message': { width: '100%', userSelect: 'text', cursor: 'text' },
          }}
          action={
            <Box sx={{ display: 'flex', gap: 0.5, mt: -0.5 }}>
              {detail && (
                <IconButton size="small" color="inherit" onClick={() => setExpanded(!expanded)}
                  title={expanded ? 'Collapse' : 'Show details'}>
                  {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </IconButton>
              )}
              <IconButton size="small" color="inherit" onClick={handleCopy}
                title="Copy to clipboard">
                <ContentCopy sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" color="inherit" onClick={() => setOpen(false)}
                title="Close">
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <Box id="notif-text" sx={{ userSelect: 'text' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, userSelect: 'text' }}>
              {message}
            </Typography>
            {copied && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Copied to clipboard
              </Typography>
            )}
            <Collapse in={expanded}>
              {detail && (
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.15)', borderRadius: 0.5,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    fontFamily: 'monospace', fontSize: 11, maxHeight: 200,
                    overflow: 'auto', userSelect: 'text', cursor: 'text',
                  }}
                >
                  {detail}
                </Typography>
              )}
            </Collapse>
          </Box>
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
