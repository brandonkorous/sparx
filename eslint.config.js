// Flat ESLint config — root of the Sparx monorepo.
// Per-package configs extend this via `import baseConfig from '../../eslint.config.js'`.
//
// The "no Tailwind classes in feature code" rule (per docs/23 §15) lives in the
// apps/* configs, NOT here, so that packages/ui can freely write Tailwind.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.{js,mjs,cjs,ts}',
      // Marketplace bundle-authoring scratch (recovered sources, generators,
      // asset renderer) — regenerated on demand, never committed (docs/85).
      'marketplace-catalog/_*/**',
      '**/_marketplace-assets.mjs',
      // Brain — the Obsidian knowledge vault (docs/brain). Human-authored notes,
      // excluded from every push gate (mirrors .prettierignore).
      'docs/brain/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.flatConfigs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
      // Map @sparx/ui field components to the DOM elements they render, so
      // jsx-a11y resolves a `<Label>`/`<label>` wrapping a `<Checkbox>` /
      // `<RadioGroupItem>` / `<Input>` / … as an associated control (the native
      // control is nested at runtime). apps/site does the same for its Sparx*
      // components; this covers the shared @sparx/ui primitives.
      'jsx-a11y': {
        components: {
          Checkbox: 'input',
          RadioGroupItem: 'input',
          Input: 'input',
          NativeSelect: 'select',
          Textarea: 'textarea',
        },
      },
    },
  },
  // Tests: relax a few typed-linting rules that fight Testing Library patterns.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/vitest.setup.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
  prettierConfig
);
