import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  // Suporta .test.js (existente) e .test.ts (após migração dos testes)
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // Configura o Babel inline, sem criar um babel.config.js global
  // (que interferiria no build do Next.js desativando o SWC)
  transform: {
    '^.+\\.jsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    }],
    '^.+\\.tsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        ['@babel/preset-typescript'],
      ],
    }],
  },
  // Permite que testes de componentes declarem @jest-environment jsdom via docblock
  testEnvironmentOptions: {},
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Coverage — só coletado quando --coverage é passado (test:coverage)
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!lib/**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  // Thresholds em dois níveis:
  //   global  — reflete a realidade atual (app/ tem 0% por ser React sem testes E2E)
  //   lib/admin-actions/ — protege o código crítico de negócio com números significativos
  // Aumentar o global progressivamente à medida que app/api/* e componentes forem cobertos.
  coverageThreshold: {
    global: {
      lines:      3,
      functions:  20,
      branches:   40,
      statements: 3,
    },
    './lib/admin-actions/': {
      lines:      70,
      functions:  85,
      branches:   55,
      statements: 70,
    },
  },
};

export default config;
