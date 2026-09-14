import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: { exclude: ['three'], include: ['peerjs'], noDiscovery: true },
  server: { host:'127.0.0.1', port:5173, strictPort:true },
  build: { rollupOptions: { output: { manualChunks: { three:['three'] } } } }
});
