import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ['common/src/**/*.{ts,tsx}', 'frontend/src/**/*.{ts,tsx}', 'service/src/**/*.{ts,tsx}'],
      thresholds: {
        lines: 33,
        branches: 23,
        functions: 23,
      },
    },
    projects: [
      {
        test: {
          name: 'Common',
          include: ['common/src/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'Service',
          include: ['service/src/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'Frontend',
          environment: 'jsdom',
          include: ['frontend/src/**/*.spec.(ts|tsx)'],
        },
        define: {
          __APP_SERVICE_PORT__: JSON.stringify('9090'),
        },
      },
    ],
  },
})
