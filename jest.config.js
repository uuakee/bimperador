module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  // Aumenta o timeout para 30 segundos para dar tempo de executar todas as operações
  testTimeout: 30000,
  // Configura o Jest para limpar os mocks entre os testes
  clearMocks: true,
  // Define o diretório raiz do projeto
  rootDir: '.',
  // Define os diretórios que o Jest deve ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  // Configura o Jest para mostrar um relatório de cobertura
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Define os arquivos que devem ser incluídos no relatório de cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**/*.js',
    '!**/node_modules/**'
  ]
}; 