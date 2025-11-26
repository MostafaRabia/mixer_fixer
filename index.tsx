import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Environment Variable Polyfill ---
// This function attempts to find the API Key from various build-tool specific locations
// and standardizes it into process.env.API_KEY for the app to use.
(function setupEnvironment() {
  let key = '';

  // 1. Try Vite (VITE_API_KEY)
  // We must access import.meta.env.VITE_API_KEY explicitly for Vite's static replacement to work.
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore errors if import.meta is not defined
  }

  // 2. Try Create React App (REACT_APP_API_KEY)
  if (!key) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY) {
        // @ts-ignore
        key = process.env.REACT_APP_API_KEY;
      }
    } catch (e) {
      // Ignore errors
    }
  }

  // 3. Try Standard API_KEY (Node/System)
  if (!key) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        // @ts-ignore
        key = process.env.API_KEY;
      }
    } catch (e) {}
  }

  // Apply to window.process.env for consistent access throughout the app
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.process = window.process || {};
    // @ts-ignore
    window.process.env = window.process.env || {};
    
    if (key) {
      // @ts-ignore
      window.process.env.API_KEY = key;
      console.log(' Mosqu Audio Tuner: API Key successfully detected.');
    } else {
      console.warn('Mosque Audio Tuner: No API Key found. Please set VITE_API_KEY in your environment.');
    }
  }
})();
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