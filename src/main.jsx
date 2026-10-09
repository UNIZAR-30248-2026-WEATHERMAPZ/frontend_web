import 'leaflet/dist/leaflet.css';
import './styles/global.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from './app/providers.jsx';
import { Router } from './app/router.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <Router />
    </AppProviders>
  </React.StrictMode>
);
