#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

const files = [...glob.sync('src/**/*.{js,jsx,ts,tsx}'), ...glob.sync('tests/**/*.{js,jsx,ts,tsx}')];

// All non-ASCII characters EXCEPT newlines, carriage returns, and tabs
// \x09 = tab, \x0A = newline (LF), \x0D = carriage return (CR)
const unicodeChars = /[^\x09\x0A\x0D\x20-\x7E]/g;

let cleaned = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const clean = content.replace(unicodeChars, '');
  if (content !== clean) {
    fs.writeFileSync(file, clean, 'utf8');
    cleaned++;
  }
});

console.log(`✅ Cleaned ${cleaned} files`);