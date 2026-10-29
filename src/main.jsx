import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import App from './App.jsx';
import { Admin } from './Admin.jsx';
import { Landing } from './components/Landing.jsx';
import { Mark } from './Mark.jsx';
import { ADMIN_AVAILABLE } from './utils/env.js';
import './index.css';

function Root() {
  const [route, setRoute] = React.useState(window.location.hash);
  React.useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (route.startsWith('#/admin')) return ADMIN_AVAILABLE ? <Admin /> : <Landing />;
  if (route.startsWith('#/mark')) return <Mark />;
  const m = /^#\/([^/]+)(?:\/(\d+))?$/.exec(route);
  if (!m) return <Landing />;
  return <App initialSkill={m[1]} initialStep={m[2] ? Number(m[2]) : undefined} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
