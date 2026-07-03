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
  // --- File & function size limits (CLAUDE.md "File & function size") -------
  // Warn-only, non-blocking: 250 lines/file, 50 lines/function. The target is
  // cohesion, not the number — split when a unit carries a SECOND responsibility,
  // not merely to satisfy the cap (three files that only call each other are
  // worse than one). Enforced opportunistically (boy-scout: split when you're
  // already touching the file), never as a dedicated sweep. Nothing sets
  // --max-warnings, so these never fail the pre-push guard or CI.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'warn',
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  // Component bodies legitimately carry JSX markup — a 50-line cap would flag
  // every non-trivial component and push toward over-fragmentation. The 250-line
  // file cap still applies; only per-function is relaxed for .tsx/.jsx.
  {
    files: ['**/*.{tsx,jsx}'],
    rules: {
      'max-lines-per-function': [
        'warn',
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  // Exempt: data-as-code (blueprints, seed, catalogs, legal/email templates) is
  // large by nature (declarative data), and tests run long per suite. Splitting
  // these by line count hurts more than it helps. (.md/.sql/.prisma/.css aren't
  // linted by this config at all, so they need no exemption here.)
  {
    files: [
      'packages/blueprints/**',
      'marketplace-catalog/**',
      'packages/legal-templates/**',
      'packages/builder-schemas/src/default-emails.ts',
      // The platform component catalog (docs/98 §5) — composed component trees are
      // declarative data-as-code, like blueprints/seeds.
      'packages/builder-schemas/src/catalog/**',
      // Module-preset catalogs (Wave 2) — declarative config packs (tax zones, CRM
      // pipelines, invoicing workflows, …) authored as data, same as the catalogs
      // above. The per-module arrays live under a `presets/` dir in each module
      // package and at the api-rest composition root for modules that don't dep the
      // preset contract.
      'packages/*/src/presets/**',
      'services/*/src/lib/presets/**',
      // Industry sample-data packs (Wave 5) — per-vertical catalogs + activity
      // authored as declarative data, same as the catalogs/presets above.
      'packages/db/src/sample-data/packs/**',
      '**/seed.ts',
      '**/_lib/catalog.ts',
      '**/module-catalog.ts',
      '**/*.{test,spec}.{ts,tsx}',
      '**/test/**',
      '**/e2e/**',
      '**/vitest.setup.{ts,tsx}',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  prettierConfig
);
