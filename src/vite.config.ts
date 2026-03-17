import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/sistema/' : '/', // Base path apenas em produção
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@components': path.resolve(__dirname, './components'),
      '@contexts': path.resolve(__dirname, './contexts'),
      '@services': path.resolve(__dirname, './services'),
      '@utils': path.resolve(__dirname, './utils'),
      '@styles': path.resolve(__dirname, './styles'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      '/sistema/api': {
        target: 'https://webpresto.com.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    minify: 'esbuild', // Mudado de 'terser' para 'esbuild' (mais rápido e já incluído)
    // ✅ CACHE BUSTING: Garante que assets sempre tenham hash único
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // ✅ Hash nos nomes dos arquivos para forçar reload quando mudar
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'recharts-vendor': ['recharts'],
        },
      },
    },
  },
}));
