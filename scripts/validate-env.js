#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * This script validates all environment variables before build/deployment
 * Run with: node scripts/validate-env.js
 * 
 * Exit codes:
 * - 0: All validations passed
 * - 1: Critical errors found (will fail build)
 * - 2: Warnings found (build continues)
 */

const path = require('path');
const fs = require('fs');

// Add src directory to require path for TypeScript compilation
const tsNode = require('ts-node');

// Configure ts-node for this script
tsNode.register({
  project: path.join(__dirname, '..', 'tsconfig.json'),
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020'
  }
});

// Now we can import TypeScript modules
const { 
  validateEnvironmentSafe, 
  generateEnvExample,
  isProduction,
  isDevelopment
} = require('../src/utils/envValidation.ts');

/**
 * Main validation function
 */
async function validateEnvironment() {
  // Check for strict mode flag
  const args = process.argv.slice(2);
  const strictMode = args.includes('--strict') || args.includes('-s');
  
  console.log(`🔍 Starting environment variable validation${strictMode ? ' (STRICT MODE)' : ''}...\n`);
  
  // Load environment variables
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('📄 Loaded .env.local file');
  } else {
    console.log('📄 No .env.local file found (using system environment)');
  }

  // Perform validation with strict mode if requested
  // Use validateEnvironmentSafe which already handles logging
  const results = validateEnvironmentSafe(process.env, strictMode);
  
  console.log('\n' + '='.repeat(60));
  
  // Handle different scenarios based on validation results
  if (results.valid) {
    if (results.warnings.length > 0) {
      // In strict mode, warnings are not acceptable
      if (strictMode) {
        console.log('🚫 Strict mode: Warnings are treated as errors');
        return 1; // Error
      }
      
      // In CI/production, warnings might be acceptable
      if (isProduction()) {
        console.log('🏭 Production build: Proceeding with default values');
        return 0; // Success
      } else {
        console.log('🔧 Development build: Warnings are normal');
        return 2; // Warnings
      }
    } else {
      console.log('🎉 Perfect! All environment variables are valid');
      return 0; // Success
    }
  } else {
    console.log('❌ Environment validation failed');
    
    // In development, provide helpful guidance
    if (isDevelopment()) {
      console.log('\n💡 To fix these issues:');
      console.log('1. Create or update your .env.local file');
      console.log('2. Use the example below as a template');
      console.log('3. Set the problematic variables');
      
      console.log('\n📝 Example .env.local file:');
      console.log('-'.repeat(40));
      console.log(generateEnvExample());
    } else {
      console.log('\n🔧 Run with NODE_ENV=development for more detailed guidance');
    }
    
    return 1; // Error
  }
}

/**
 * Enhanced error handling
 */
async function main() {
  try {
    const exitCode = await validateEnvironment();
    
    console.log('\n' + '='.repeat(60));
    
    switch (exitCode) {
      case 0:
        console.log('✅ Environment validation completed successfully');
        break;
      case 1:
        console.log('❌ Environment validation failed');
        console.log('🚫 Build will be aborted');
        break;
      case 2:
        console.log('⚠️  Environment validation completed with warnings');
        console.log('▶️  Build will continue');
        break;
    }
    
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n💥 Fatal error during environment validation:');
    console.error(error.message);
    
    if (error.stack && isDevelopment()) {
      console.error('\n🔍 Stack trace (development mode):');
      console.error(error.stack);
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check that all required dependencies are installed');
    console.error('2. Verify TypeScript compilation is working');
    console.error('3. Check for syntax errors in environment validation');
    
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Environment validation interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Environment validation terminated');
  process.exit(1);
});

// Run the validation
main();