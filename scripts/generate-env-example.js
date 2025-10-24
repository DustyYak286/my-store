#!/usr/bin/env node

/**
 * Generate example environment file script
 */

const path = require('path');

// Configure ts-node for TypeScript compilation
const tsNode = require('ts-node');
tsNode.register({
  project: path.join(__dirname, '..', 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020'
  }
});

// Import the generation function
const { generateEnvExample } = require('../src/utils/envValidation.ts');

// Generate and output the example
console.log(generateEnvExample());