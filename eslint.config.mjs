import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixupPluginRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import _import from 'eslint-plugin-import'
import jsxA11Y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-plugin-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import security from 'eslint-plugin-security'
import unusedImports from 'eslint-plugin-unused-imports'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  {
    ignores: [
      'node_modules',
      'build',
      'coverage',
      'release',
      '**/.DS_Store',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      'public/dev.js',
      'public/electron.js',
      'src/renderer/types/generated'
    ]
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended-legacy',
    'plugin:prettier/recommended'
  ),
  _import.flatConfigs.recommended,
  {
    plugins: {
      react,
      'react-hooks': fixupPluginRules(reactHooks),
      prettier,
      'unused-imports': unusedImports,
      security,
      'jsx-a11y': jsxA11Y
    },

    languageOptions: {
      globals: {
        $COMMIT_HASH: true,
        $IS_DEV: true
      },

      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    settings: {
      'import/resolver': {
        typescript: {}
      },
      react: {
        version: 'detect'
      }
    },

    rules: {
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-undef': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      '@typescript-eslint/no-use-before-define': [
        'warn',
        {
          functions: false,
          classes: false,
          variables: false,
          typedefs: false
        }
      ],

      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',

      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowTernary: true
        }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_'
        }
      ],

      '@typescript-eslint/no-var-requires': 'off',
      'security/detect-object-injection': 'off',
      'import/no-anonymous-default-export': 'off',

      'import/newline-after-import': [
        'error',
        {
          count: 1
        }
      ],

      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'parent'],

          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before'
            }
          ],

          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'ignore',

          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ],

      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'warn',
        {
          caughtErrorsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ]
    }
  }
]
