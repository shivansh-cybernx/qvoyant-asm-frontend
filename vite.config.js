import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function appProxy(env) {
  return {
    // Same-origin auth so Set-Cookie(accessToken) lands on :5174
    '/auth-api': {
      target: env.VITE_AUTH_PROXY_TARGET || 'http://localhost:5001',
      changeOrigin: true,
      rewrite: (requestPath) => requestPath.replace(/^\/auth-api/, ''),
      configure(proxy) {
        // Auth-server CORS is for the host shell (:5173). This demo calls it
        // same-origin through Vite, so drop the browser Origin on the upstream request.
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.removeHeader('origin');
        });
      },
    },
    // Same-origin ASM API so the auth cookie is sent (ports differ otherwise).
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
      changeOrigin: true,
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_APP_PORT || 5174);

  return {
    plugins: [
      react(),
      federation({
        name: 'asmApp',
        filename: 'remoteEntry.js',
        dts: false,
        exposes: {
          './AsmApp': './src/AsmApp.jsx',
        },
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
          'react-router-dom': { singleton: true },
        },
      }),
    ],
    server: {
      host: true, // 0.0.0.0 — reachable from Windows via localhost when running in WSL
      port,
      strictPort: true,
      origin: `http://localhost:${port}`,
      cors: true,
      // Same-origin proxies for auth cookie + ASM API.
      proxy: appProxy(env),
      hmr: {
        host: 'localhost',
        protocol: 'ws',
        clientPort: port,
      },
    },
    preview: {
      host: true,
      port,
      cors: true,
      proxy: appProxy(env),
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      outDir: 'dist',
    },
    base: process.env.VITE_BASE || '/',
    optimizeDeps: {
      exclude: ['react', 'react-dom', 'react-router-dom'],
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Common UI from the shared frontend packages, not a second copy in this app.
        '@qvoyant/ui': path.resolve(__dirname, '../qvoyant-fe-packages/ui/src'),
      },
    },
  };
});
