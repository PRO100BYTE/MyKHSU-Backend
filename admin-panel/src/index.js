import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter basename="/admin-panel">
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
