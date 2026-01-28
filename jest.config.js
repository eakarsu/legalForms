/**
 * Jest Configuration for Legal Forms Generator
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js'
    ],

    // Coverage configuration
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**'
    ],

    // Setup and teardown
    globalSetup: './tests/helpers/globalSetup.js',
    globalTeardown: './tests/helpers/globalTeardown.js',

    // Timeout for async tests (30 seconds for database operations)
    testTimeout: 30000,

    // Run tests sequentially to avoid database conflicts
    maxWorkers: 1,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>']
};
