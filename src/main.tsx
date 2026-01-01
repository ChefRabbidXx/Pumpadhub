import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { Buffer } from 'buffer';
import { WalletProvider } from './contexts/WalletContext';
import { WalletProviders } from './components/wallet/WalletProviders';

// Make Buffer globally available
window.Buffer = Buffer;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProviders>
        <WalletProvider>
          <App />
        </WalletProvider>
      </WalletProviders>
    </BrowserRouter>
  </React.StrictMode>
);
