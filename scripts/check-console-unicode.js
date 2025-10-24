#!/usr/bin/env node

/**
 * Check for Unicode characters in console statements
 * Used by pre-commit hooks and CI to enforce ASCII-only logging
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const IGNORE_PATTERNS = ['node_modules/**', 'dist/**', 'build/**', '.next/**'];

function checkFileForConsoleUnicode(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Check for console methods
    const consoleMatch = line.match(/console\.(log|warn|error|info|debug)/);
    if (consoleMatch) {
      // Check for non-ASCII characters in the line, allowing tabs and newlines
      const nonAsciiMatch = line.match(/[^\x09\x0A\x0D\x20-\x7E]/);
      if (nonAsciiMatch) {
        violations.push({
          file: filePath,
          line: index + 1,
          column: nonAsciiMatch.index + 1,
          character: nonAsciiMatch[0],
          lineContent: line.trim()
        });
      }
    }
  });

  return violations;
}

function main() {
  const srcPattern = 'src/**/*.{js,jsx,ts,tsx}';
  const testPattern = 'tests/**/*.{js,jsx,ts,tsx}';
  
  const files = [
    ...glob.sync(srcPattern),
    ...glob.sync(testPattern)
  ];

  const allViolations = [];

  files.forEach(file => {
    const violations = checkFileForConsoleUnicode(file);
    allViolations.push(...violations);
  });

  if (allViolations.length > 0) {
    console.error('❌ Found Unicode characters in console statements:');
    console.error('   Use ASCII alternatives: [DEBUG], [REDIRECT], [TARGET]\n');
    
    allViolations.forEach(v => {
      console.error(`${v.file}:${v.line}:${v.column}`);
      console.error(`  ${v.lineContent}`);
      console.error(`  Character: "${v.character}" (Unicode)\n`);
    });
    
    process.exit(1);
  }

  console.log('✅ All console statements use ASCII characters');
}

if (require.main === module) {
  main();
}

module.exports = { checkFileForConsoleUnicode };