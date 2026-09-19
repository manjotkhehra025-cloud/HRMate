import React, { lazy, Suspense, useEffect, useMemo } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { useHashRoute } from './lib/hooks.js';
import { setRouterNavigate, LoadingBlock, Toaster } from './ui/index.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

const PAGES = {
  dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  attendance: lazy(() => import('./pages/Attendance.jsx')),
  employees: lazy(() => import('./pages/Employees.jsx')),
  'employee-detail': lazy(() => import('./pages/EmployeeDetail.jsx')),
  directory: lazy(() => import('./pages/Directory.jsx')),
  leaves: lazy(() => import('./pages/Leaves.jsx')),
  approvals: lazy(() => import('./pages/Approvals.jsx')),
  roster: lazy(() => import('./pages/Roster.jsx')),
  shifts: lazy(() => import('./pages/Shifts.jsx')),
  calendar: lazy(() => import('./pages/Calendar.jsx')),
  documents: lazy(() => import('./pages/Documents.jsx')),
  kyc: lazy(() => import('./pages/Kyc.jsx')),
  idcard: lazy(() => import('./pages/IdCard.jsx')),
  goals: lazy(() => import('./pages/Goals.jsx')),
  performance: lazy(() => import('./pages/Performance.jsx')),
  social: lazy(() => import('./pages/Social.jsx')),
  'star-workers': lazy(() => import('./pages/StarWorkers.jsx')),
  helpdesk: lazy(() => import('./pages/Helpdesk.jsx')),
  announcements: lazy(() => import('./pages/Announcements.jsx')),
  reports: lazy(() => import('./pages/Reports.jsx')),
  admin: lazy(() => import('./pages/Admin.jsx')),
  devices: lazy(() => import('./pages/Devices.jsx')),
  audit: lazy(() => import('./pages/AuditLogs.jsx')),
  notifications: lazy(() => import('./pages/NotificationsPage.jsx')),
  settings: lazy(() => import('./pages/Settings.jsx')),
  profile: lazy(() => import('./pages/Profile.jsx'))
};

// path → page key + param names
const ROUTES = [
  { path: '/dashboard', page: 'dashboard' },
  { path: '/attendance', page: 'attendance' },
  { path: '/employees', page: 'employees' },
  { path: '/employees/:id', page: 'employee-detail', param: 'id' },
  { path: '/directory', page: 'directory' },
  { path: '/leaves', page: 'leaves' },
  { path: '/approvals', page: 'approvals' },
  { path: '/roster', page: 'roster' },
  { path: '/shifts', page: 'shifts' },
  { path: '/calendar', page: 'calendar' },
  { path: '/documents', page: 'documents' },
  { path: '/kyc', page: 'kyc' },
  { path: '/id-card', page: 'idcard' },
  { path: '/goals', page: 'goals' },
  { path: '/performance', page: 'performance' },
  { path: '/social', page: 'social' },
  { path: '/star-workers', page: 'star-workers' },
  { path: '/helpdesk', page: 'helpdesk' },
  { path: '/announcements', page: 'announcements' },
  { path: '/reports', page: 'reports' },
  { path: '/admin', page: 'admin' },
  { path: '/devices', page: 'devices' },
  { path: '/audit', page: 'audit' },
  { path: '/notifications', page: 'notifications' },
  { path: '/settings', page: 'settings' },
  { path: '/profile', page: 'profile' }
];

function matchRoute(path) {
  for (const r of ROUTES) {
    const rp = r.path.split('/');
    const pp = path.split('/');
    if (rp.length !== pp.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rp.length; i += 1) {
      if (rp[i].startsWith(':')) params[rp[i].slice(1)] = decodeURIComponent(pp[i]);
      else if (rp[i] !== pp[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { ...r, params };
  }
  return null;
}

function Router() {
  const { session, booting } = useStore();
  const route = useHashRoute();
  const match = useMemo(() => matchRoute(route.path), [route.path]);

  useEffect(() => {
    setRouterNavigate((to) => {
      window.location.hash = to;
    });
  }, []);

  useEffect(() => {
    if (!booting && !session && route.path !== '/login') window.location.hash = '/login';
    if (!booting && session && (route.path === '/login' || route.path === '/')) window.location.hash = '/dashboard';
  }, [booting, session, route.path]);

  if (booting) return <LoadingBlock label="Starting HRMate…" />;
  if (!session) return <Login />;

  const Page = PAGES[match?.page] || PAGES.dashboard;

  return (
    <Layout route={match?.path || '/dashboard'}>
      <Suspense fallback={<LoadingBlock />}>
        <Page params={match?.params || {}} query={route.query} />
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}
