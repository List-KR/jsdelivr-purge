import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {selector: 'variableLike', format: ['camelCase']},
        {selector: 'typeLike', format: ['camelCase']},
        {selector: 'class', format: ['PascalCase']},
        {selector: 'import', format: ['camelCase', 'PascalCase']},
        {selector: 'method', format: ['camelCase']},
        {selector: 'classProperty', format: ['camelCase']},
      ],
    },
  }
)
