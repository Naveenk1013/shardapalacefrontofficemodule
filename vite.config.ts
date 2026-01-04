import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For subdomain deployment (pms.yourhotel.com), use '/'
  // For subfolder deployment (yourhotel.com/pms/), use '/pms/'
  base: '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

