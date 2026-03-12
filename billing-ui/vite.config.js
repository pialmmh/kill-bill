import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/1.0/kb': {
        target: 'http://127.0.0.1:18080',
        changeOrigin: true,
      },
    },
  },
})
