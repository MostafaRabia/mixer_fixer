import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Environment Variable Polyfill ---
// This ensures the app can read the API key in various environments (Vite, Netlify, etc.)
// where process.env might not be defined or the key is prefixed with VITE_.
if (typeof window !== 'undefined') {
  // Ensure window.process exists
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = { env: {} };
  }
  // Ensure window.process.env exists
  if (typeof (window as any).process.env === 'undefined') {
    (window as any).process.env = {};
  }

  // Check for modern build tool env vars (Vite)
  // @ts-ignore
  const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : {};
  
  // Try to find the key in different common locations
  const potentialKey = 
    viteEnv?.VITE_API_KEY || 
    viteEnv?.REACT_APP_API_KEY || 
    (window as any).process.env.API_KEY;

  // If found, ensure it's available where the Gemini SDK expects it (process.env.API_KEY)
  if (potentialKey) {
    (window as any).process.env.API_KEY = potentialKey;
  }
}
// -------------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);