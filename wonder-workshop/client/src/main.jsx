import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Build visibility — so anyone can confirm which deploy they're on (kills the
// "is my tab cached?" confusion). Inspect <html data-build> or check the
// console; a small tag also shows in the corner. __BUILD_ID__ is the deploy's
// commit SHA, injected at build time (see vite.config.js).
if (typeof document !== 'undefined') {
  document.documentElement.dataset.build = __BUILD_ID__
  // eslint-disable-next-line no-console
  console.log(`%cWonder Workshop · build ${__BUILD_ID__}`, 'color:#9aa; font-weight:600')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
