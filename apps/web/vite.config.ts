import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Bind every interface. The default binds IPv6 loopback only, so
    // 127.0.0.1 and any other device on the network cannot reach the dev
    // server — which is confusing to debug and blocks testing on a phone.
    host: true,
    // The API owns its own routes; everything under /api is forwarded so the
    // browser sees one origin and the session cookie is sent without CORS.
    // 127.0.0.1 rather than localhost: the API listens on IPv4, and resolving
    // localhost to ::1 here would make every proxied request fail.
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true } },
  },
});
