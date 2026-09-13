import js from '@eslint/js'
import ts from 'typescript-eslint'

export default ts.config([
  { ignores: ['node_modules', '*.config.{ts,js}'] },
  js.configs.recommended,
  ts.configs.recommended,
  {
    files: ['**/*.{ts,jsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports'
        }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['**/*.{ts,jsx}'],
    rules: {}
  }
])
