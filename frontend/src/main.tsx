/**
 * @file frontend/src/main.tsx
 * @description Application client bootstrapper.
 * Establishes client-side routing, binds ThemeProvider, and mounts page templates.
 * 
 * Connected Modules:
 * - frontend/index.html (shell parser)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Router, Route, Switch, Redirect } from 'wouter';
import { ThemeProvider } from './theme';
import Layout from './components/layout';
import Dashboard from './pages/dashboard';
import Destinations from './pages/destinations';
import Rules from './pages/rules';
import Symbols from './pages/symbols';
import Policies from './pages/policies';
import SuperAdmin from './pages/super-admin';
import Login from './pages/login';
import Register from './pages/register';
import './index.css';

// Direct routing guard checking authorization state
const RouteGuard: React.FC<{ component: React.ComponentType; path: string }> = ({ component: Component, path }) => {
  const token = localStorage.getItem('brp_token');
  
  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
};

const SuperAdminGuard: React.FC<{ component: React.ComponentType }> = ({ component: Component }) => {
  const token = localStorage.getItem('brp_token');
  const rawUser = localStorage.getItem('brp_user');
  const user = rawUser ? JSON.parse(rawUser) : null;

  if (!token) {
    return <Redirect to="/login" />;
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
};

const RootApp = () => {
  return (
    <ThemeProvider>
      <Router>
        <Switch>
          {/* Public login/register endpoints */}
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />

          {/* Protected dashboard endpoints */}
          <Route path="/">
            <RouteGuard component={Dashboard} path="/" />
          </Route>
          <Route path="/destinations">
            <RouteGuard component={Destinations} path="/destinations" />
          </Route>
          <Route path="/rules">
            <RouteGuard component={Rules} path="/rules" />
          </Route>
          <Route path="/symbols">
            <RouteGuard component={Symbols} path="/symbols" />
          </Route>
          <Route path="/policies">
            <RouteGuard component={Policies} path="/policies" />
          </Route>
          <Route path="/super-admin">
            <SuperAdminGuard component={SuperAdmin} />
          </Route>

          {/* Catch-all fallback redirect */}
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
      </Router>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
