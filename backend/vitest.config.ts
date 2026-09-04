const { defineConfig } = require('vitest/config');
module.exports = defineConfig({ test: { include: ['src/**/*.spec.ts'], exclude: ['dist/**', 'node_modules/**'] } });
