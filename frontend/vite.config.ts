import { codecovVitePlugin } from '@codecov/vite-plugin'
import { defineConfig, loadEnv } from 'vite'

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
      rolldownOptions: {
        external: ['vitest'],
      },
    },
  }
})
