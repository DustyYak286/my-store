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
    plugins: {
      custom: {
        rules: {
          'no-console-unicode': {
            create(context) {
              return {
                CallExpression(node) {
                  if (node.callee.type === 'MemberExpression' && 
                      node.callee.object.name === 'console' && 
                      node.arguments.length > 0) {
                    node.arguments.forEach(arg => {
                      if (arg.type === 'Literal' && typeof arg.value === 'string' && /[^\x20-\x7E]/.test(arg.value)) {
                        context.report({ node: arg, message: 'Console statements should use ASCII characters only. Use [DEBUG], [REDIRECT], etc. instead of Unicode.' });
                      }
                    });
                  }
                }
              };
            }
          }
        }
      }
    },
    rules:   {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'custom/no-console-unicode': 'error',
    },        // your overrides here
  },
];