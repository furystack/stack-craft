import { codecovVitePlugin } from '@codecov/vite-plugin'
import { defineConfig, loadEnv } from 'vite'

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
}

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', 'APP_')
  const servicePort = env.APP_SERVICE_PORT || '9090'

  return {
    define: {
      __APP_SERVICE_PORT__: JSON.stringify(servicePort),
    },
    plugins: [
      codecovVitePlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: 'shades-showcase-app',
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    ],
    build: {
      minify: false,
      sourcemap: true,
      rolldownOptions: {
        external: ['vitest'],
      },
    },
  }
})
