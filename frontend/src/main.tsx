import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// Registrar todos los módulos de AG Grid Community
ModuleRegistry.registerModules([AllCommunityModule])

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)