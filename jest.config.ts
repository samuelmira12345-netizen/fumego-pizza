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
};

export default config;
