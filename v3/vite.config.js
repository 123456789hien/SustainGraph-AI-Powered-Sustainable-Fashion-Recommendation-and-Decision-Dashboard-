import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard/',
  build: {
    outDir: 'dist'
  }
});
