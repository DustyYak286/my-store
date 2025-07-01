import { FlatCompat } from '@eslint/eslintrc';
import globalsPkg from 'globals';

// legacy presets we still want
const compat = new FlatCompat({
  baseDirectory: import.meta.url,
});

const jsGlobals = {
  ...globalsPkg.browser,
  ...globalsPkg.node,
};

export default [
  // 1️⃣ Convert legacy presets to flat format
  ...compat.extends(
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@next/next/recommended',
    'plugin:@next/next/core-web-vitals'
  ),

  // 2️⃣ Your own flat-config block
  {
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: jsGlobals,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {},        // add object map if you have custom rules later
    rules:   {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },        // your overrides here
  },
];