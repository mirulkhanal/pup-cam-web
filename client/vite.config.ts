import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxy = env.VITE_API_PROXY || 'http://127.0.0.1:3002';

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), basicSsl()],
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['meecachy', '.ts.net'],
      proxy: {
        '/api': { target: apiProxy, changeOrigin: true },
        '/health': { target: apiProxy, changeOrigin: true },
        '/socket.io': {
          target: apiProxy,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
