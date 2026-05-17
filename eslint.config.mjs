import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'test-results/**',
    'PFMEA/**',
    '*.png',
    'tmp-*.js',
  ]),

  {
    files: ['scripts/regression/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: [
      'app/pcp/page.tsx',
      'app/pfd/page.tsx',
      'app/pfd/_lib/**/*.tsx',
      'app/pfmea/page.tsx',
      'app/settings/invitations/page.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: [
      'app/login/page.tsx',
      'app/pcp/page.tsx',
      'app/pfd/page.tsx',
      'app/pfmea/page.tsx',
      'app/settings/invitations/page.tsx',
      'app/settings/layout.tsx',
      'app/settings/organizations/page.tsx',
      'app/settings/sites-departments/page.tsx',
      'src/components/Layout/AppHeader.tsx',
      'src/features/settings/CustomerAccessPanel.tsx',
      'src/features/settings/rating-scale/RatingScaleTable.tsx',
      'src/features/settings/risk-matrix/use-risk-matrix-controller.ts',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  {
    files: ['app/pcp/page.tsx', 'app/pfmea/page.tsx', 'src/components/Layout/AppHeader.tsx'],
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },

  {
    files: ['app/pfmea/page.tsx'],
    rules: {
      'react-hooks/refs': 'off',
    },
  },

])

export default eslintConfig
