/** @type {import('jest').Config} */
const config = {
  // Adicionar mais configurações de setup aqui
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mapear arquivos estáticos e estilos
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/__mocks__/fileMock.js"
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  // Ignorar o diretório node_modules, mas permitir algumas libs que exigem transformação
  transformIgnorePatterns: [
    "/node_modules/(?!(@radix-ui|lucide-react|next)/)"
  ],
  // Usar ts-jest para compilar TypeScript e babel-jest para JSX
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }],
          '@babel/preset-typescript'
        ]
      }
    ],
    '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  // Configuração de cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/__tests__/**'
  ],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],

  // Configurações adicionais
  // Removendo globals de ts-jest pois estamos usando babel-jest para tudo
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

module.exports = config; 