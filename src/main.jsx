import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { PrivacyProvider } from './lib/privacy';
import { ToastProvider } from './components/Toast';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/hanken-grotesk/index.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <PrivacyProvider>
                <ToastProvider>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </ToastProvider>
            </PrivacyProvider>
        </BrowserRouter>
    </React.StrictMode>,
);