import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.VITE_API_PROXY ?? 'http://localhost:4000';
const proxy = {
  '/api': { target: api, changeOrigin: true },
  '/socket.io': { target: api, ws: true, changeOrigin: true },
};

/** Long-lived vendor chunks: they change far less often than app code, so browsers keep them cached. */
const vendorGroups = [
  { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
  {
    name: 'data',
    test: /node_modules[\\/](@tanstack|zod|socket\.io-client|engine\.io-client|socket\.io-parser|@socket\.io)[\\/]/,
  },
  { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
  {
    name: 'markdown',
    test: /node_modules[\\/](react-markdown|remark-.*|micromark.*|mdast-.*|hast-.*|unist-.*|unified|vfile.*|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities.*|trim-lines|devlop|bail|trough|is-plain-obj|ccount|escape-string-regexp|markdown-table|longest-streak|zwitch|html-url-attributes|style-to-.*|inline-style-parser|estree-util-.*)[\\/]/,
  },
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: { codeSplitting: { groups: vendorGroups } },
    },
  },
});
