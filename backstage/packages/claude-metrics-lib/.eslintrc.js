// This code is shared with the Nuxt app and is also linted by its ESLint config (repo root),
// which allows these patterns. Only the Backstage rules that conflict with that style are off.
module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  rules: {
    'default-case': 'off',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'new-cap': 'off',
    'no-nested-ternary': 'off',
    '@typescript-eslint/no-shadow': 'off',
  },
});
