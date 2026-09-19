import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, openNotificationStream, setToken } from './api.js';
import { dirOf, translate } from './i18n.js';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const THEME_KEY = 'hrmate.theme';
const LOCALE_KEY = 'hrmate.locale';

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function StoreProvider({ children }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'system');
  const [locale, setLocale] = useState(() => localStorage.getItem(LOCALE_KEY) || 'en');
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const esRef = useRef(null);

  // --- theme ---------------------------------------------------------------
  const resolvedTheme = theme === 'system' ? systemTheme() : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.classList.toggle('light', resolvedTheme === 'light');
    root.style.colorScheme = resolvedTheme;
    localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolvedTheme === 'dark' ? '#0b0d13' : '#2247e8';
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // --- i18n ----------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);

  // --- toasts --------------------------------------------------------------
  const toast = useCallback((message, tone = 'info', action) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { id, message, tone, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), action ? 6000 : 3600);
  }, []);
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  // --- session -------------------------------------------------------------
  const applySession = useCallback((payload, token) => {
    if (token) setToken(token);
    setSession(payload);
  }, []);

  const login = useCallback(
    async (body) => {
      const data = await api.post('/api/auth/login', body);
      applySession(data, data.token);
      return data;
    },
    [applySession]
  );

  const loginWithPin = useCallback(
    async (body) => {
      const data = await api.post('/api/auth/pin', body);
      applySession(data, data.token);
      return data;
    },
    [applySession]
  );

  const loginWithBiometric = useCallback(
    async (body) => {
      const data = await api.post('/api/auth/biometric', body);
      applySession(data, data.token);
      return data;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      /* ignore */
    }
    esRef.current?.close();
    esRef.current = null;
    setToken(null);
    setSession(null);
    setNotifications([]);
    setUnread(0);
  }, []);

  // restore session on boot
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) {
        setBooting(false);
        return;
      }
      try {
        const data = await api.get('/api/auth/me');
        if (alive) {
          setSession(data);
          if (data.employee?.settings?.theme) setTheme(data.employee.settings.theme);
        }
      } catch {
        setToken(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- notifications stream -------------------------------------------------
  useEffect(() => {
    if (!session?.employee?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const data = await api.get('/api/notifications?limit=40');
        if (!alive) return;
        setNotifications(data.rows);
        setUnread(data.unread);
      } catch {
        /* offline */
      }
    })();
    const es = openNotificationStream((event) => {
      if (event.type === 'notification' && event.notification) {
        setNotifications((prev) => [event.notification, ...prev.filter((n) => n.id !== event.notification.id)].slice(0, 60));
        setUnread((u) => u + 1);
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(event.notification.title, { body: event.notification.body, icon: '/favicon.ico' });
          } catch {
            /* ignore */
          }
        }
      }
    });
    esRef.current = es;
    return () => {
      alive = false;
      es?.close();
      esRef.current = null;
    };
  }, [session?.employee?.id]);

  const markNotificationsRead = useCallback(async (id = null) => {
    try {
      const res = await api.post(id ? '/api/notifications/read' : '/api/notifications/read-all', id ? { id } : {});
      setUnread(res.unread);
      setNotifications((prev) => prev.map((n) => (id ? (n.id === id ? { ...n, read: 1 } : n) : { ...n, read: 1 })));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setSession(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const setPref = useCallback(
    async (patch) => {
      if (patch.theme) setTheme(patch.theme);
      if (patch.locale) setLocale(patch.locale);
      try {
        await api.patch('/api/auth/preferences', patch);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      session,
      employee: session?.employee || null,
      company: session?.company || null,
      locations: session?.locations || [],
      shifts: session?.shifts || [],
      permissions: session?.employee?.permissions || [],
      can: (perm) => {
        const list = session?.employee?.permissions || [];
        if (session?.employee?.role === 'super_admin') return true;
        return list.includes(perm);
      },
      booting,
      theme,
      resolvedTheme,
      setTheme,
      locale,
      setLocale,
      t,
      dir: dirOf(locale),
      toasts,
      toast,
      dismissToast,
      notifications,
      unread,
      markNotificationsRead,
      login,
      loginWithPin,
      loginWithBiometric,
      logout,
      refreshSession,
      setPref,
      navOpen,
      setNavOpen,
      applySession
    }),
    [
      session,
      booting,
      theme,
      resolvedTheme,
      locale,
      t,
      toasts,
      toast,
      dismissToast,
      notifications,
      unread,
      markNotificationsRead,
      login,
      loginWithPin,
      loginWithBiometric,
      logout,
      refreshSession,
      setPref,
      navOpen,
      applySession
    ]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
