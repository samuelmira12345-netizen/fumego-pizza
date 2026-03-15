import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  // Suporta .test.js (existente) e .test.ts (após migração dos testes)
  testMatch: ['**/__tests__/**/*.test.[jt]s'],
  // Configura o Babel inline, sem criar um babel.config.js global
  // (que interferiria no build do Next.js desativando o SWC)
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
    '^.+\\.ts$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-typescript'],
      ],
    }],
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
  // Thresholds baseados na cobertura atual — aumentar à medida que testes forem adicionados
  coverageThreshold: {
    global: {
      lines: 0,
      functions: 8,
      branches: 25,
      statements: 0,
    },
  },
};

export default config;
