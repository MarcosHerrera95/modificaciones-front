// jest.config.js - Configuración de Jest para Changánet (ES Modules)
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js|mjs)',
    '**/?(*.)+(spec|test).+(ts|tsx|js|mjs)'
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  collectCoverageFrom: [
    'src/**/*.js',
    'src/**/*.mjs',
    '!src/server.js',
    '!src/docs/**',
    '!src/config/serviceAccountKey.json',
    '!src/tests/setupTestDB.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTestDB.js'],
  testTimeout: 10000,
  verbose: true,
  transform: {
    '^.+\\.(js|jsx|mjs)$': 'babel-jest'
  }
};