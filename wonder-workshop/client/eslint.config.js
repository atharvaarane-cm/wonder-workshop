import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        __BUILD_ID__: 'readonly', // injected by vite define() at build time
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Blocking gate = real bugs only. no-undef + rules-of-hooks stay errors
      // (they catch the ReferenceError / broken-hook class the audit flagged).
      // The pre-existing style noise (unused vars, react-refresh, empty blocks)
      // is downgraded to warnings so `npm run lint` can be a meaningful CI gate
      // now, and we ratchet the warnings down over time rather than blocking on
      // a 130-item cleanup.
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'no-useless-assignment': 'warn',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  {
    // Node-context files (build config) — give them node globals so `process`
    // etc. aren't false-positive no-undefs.
    files: ['**/*.config.{js,ts}', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
