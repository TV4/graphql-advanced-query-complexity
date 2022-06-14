module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],

  plugins: ['prettier'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-var-requires': 'off', // escape hatch for allowing require in jest tests
    'no-case-declarations': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportDefaultDeclaration',
        message: 'Disallowed default export. Use named exports',
      },
    ],
    'no-console': ['error'],
  },
  env: {
    node: true,
    jasmine: true,
    jest: true,
    es6: true,
  },
  overrides: [
    {
      files: ['**/*.test.{js,jsx,ts,tsx}'],
      rules: {
        '@typescript-eslint/no-empty-function': 0,
        'no-console': 0,
        'no-restricted-imports': 0,
      },
    },
  ],
};
