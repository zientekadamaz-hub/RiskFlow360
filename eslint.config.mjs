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
    'app/pfmea/pageBackup.tsx',
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
      'app/projects/page.tsx',
      'app/settings/invitations/page.tsx',
      'app/settings/risk-matrix/page.tsx',
      'app/settings/sites-departments/page.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['app/pcp/page.tsx', 'app/pfmea/page.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  {
    files: ['app/settings/risk-matrix/page.tsx'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
])

export default eslintConfig
