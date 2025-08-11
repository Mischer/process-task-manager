const security = require('eslint-plugin-security');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', '.serverless/**', '.webpack/**', 'dist/**', 'coverage/**']
  },

  // JS rules for Node 20 (CommonJS)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        require: 'readonly'
      }
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,

      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },

  prettier
];
