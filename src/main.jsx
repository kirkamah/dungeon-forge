import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { ConfirmProvider } from './components/ConfirmProvider.jsx'
import { initSettings } from './storage/settings.js'

// Apply saved theme + interface scale before the first paint.
initSettings()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </I18nProvider>
  </StrictMode>,
)
