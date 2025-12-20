/**
 * Jest Global Teardown
 * Runs once after all test suites complete
 */

module.exports = async () => {
    console.log('\n🧹 Cleaning up test environment...');
    console.log('✅ Test environment cleanup complete\n');
};
