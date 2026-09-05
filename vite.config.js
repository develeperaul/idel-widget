import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  plugins: [
    vue({ template: { transformAssetUrls: false } }),
    {
      name: 'idel-dev-entry',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace('<script src="build/app.js"></script>', '<script type="module" src="/src/main.js"></script>');
      },
    },
  ],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify(command === 'serve' ? 'development' : 'production') },
  build: {
    outDir: 'build',
    target: 'es2018',
    lib: { entry: 'src/main.js', name: 'IdelApp', formats: ['iife'], fileName: () => 'app.js' },
  },
}));
