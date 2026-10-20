// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Apostrophes and quotes in <Text> are fine in React Native (this rule is about HTML)
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
