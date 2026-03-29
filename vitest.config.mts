import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ['common/src/**/*.{ts,tsx}', 'frontend/src/**/*.{ts,tsx}', 'service/src/**/*.{ts,tsx}'],
      thresholds: {
        lines: 27,
        branches: 22,
        functions: 17,
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
      },
    ],
  },
})
