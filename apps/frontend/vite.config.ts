import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';

  return {
    base: isCapacitor ? './' : '/',
    build: {
      outDir: isCapacitor ? 'dist-capacitor' : 'dist',
      emptyOutDir: true
    },
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8080',
        '/ws': {
          target: 'ws://127.0.0.1:8080',
          ws: true
        }
      }
    }
  };
});
