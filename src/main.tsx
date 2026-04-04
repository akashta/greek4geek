import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { initTelegramWebApp } from './lib/telegram';
import './styles/global.css';

Sentry.init({
  dsn: 'https://665aaaba0dec4ee518043b1cb542a6f2@o923644.ingest.us.sentry.io/4511160558944256',
  sendDefaultPii: true,
});

initTelegramWebApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
