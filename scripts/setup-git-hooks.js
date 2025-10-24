#!/usr/bin/env node

/**
 * Setup git hooks for ASCII validation
 * Run with: npm run setup:hooks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Configure git to use our hooks directory
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  
  // Make hooks executable on Unix systems
  const hooksDir = path.join(__dirname, '..', '.githooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir);
    hooks.forEach(hook => {
      const hookPath = path.join(hooksDir, hook);
      try {
        fs.chmodSync(hookPath, 0o755);
      } catch (e) {
        // Windows or permission issue, continue
      }
    });
  }
  
  console.log('✅ Git hooks configured successfully');
  console.log('   Pre-commit hook will check for console Unicode violations');
} catch (error) {
  console.error('❌ Failed to setup git hooks:', error.message);
  process.exit(1);
}