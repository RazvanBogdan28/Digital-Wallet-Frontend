import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development every /api call is proxied to the real backend, so the
// browser only ever talks to localhost and CORS never gets in the way.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target =
    env.VITE_PROXY_TARGET || 'https://digital-wallet-api-production-2f16.up.railway.app';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
          },
        },
      },
    },
  };
});
