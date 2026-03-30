import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import AuthProvider from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'
import App from './App.jsx'
import { notificationService } from './services/notificationService.js'

// Inicializar Service Worker
notificationService.registerServiceWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  </StrictMode>,
)


