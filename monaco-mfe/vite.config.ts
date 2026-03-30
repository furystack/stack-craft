import { defineConfig } from 'vite'

export default defineConfig({
  base: '/monaco-mfe/',
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    minify: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
})
