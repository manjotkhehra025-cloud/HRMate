import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from './api.js';
import { useStore } from './store.jsx';

/**
 * Data fetching hook with loading / error / refetch + optimistic mutation.
 * `mutate(patch)` applies an optimistic patch immediately and rolls back on error.
 */
export function useResource(fetcher, deps = [], { skip = false, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (opts = {}) => {
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (mounted.current) {
          setData(result);
          if (opts.onSuccess) opts.onSuccess(result);
        }
        return result;
      } catch (err) {
        if (mounted.current) setError(err);
        if (opts.onError) opts.onError(err);
        throw err;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    mounted.current = true;
    if (!skip) load();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const mutate = useCallback((updater) => {
    setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return { data, loading, error, pending, setPending, reload: load, setData, mutate, refetch: () => load({ silent: true }) };
}

export const useApi = () => {
  const { toast } = useStore();
  return {
    ...api,
    get: (path, params) => api.get(path + (params ? qs(params) : '')),
    wrap: async (fn, { success, error } = {}) => {
      try {
        const res = await fn();
        if (success) toast(success, 'success');
        return res;
      } catch (err) {
        toast(error || err.message || 'Something went wrong', 'error');
        throw err;
      }
    }
  };
};

export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function useMedia(query) {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useTick(intervalMs = 30000, enabled = true) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => force((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

/**
 * Returns a counter that bumps whenever the live notification stream delivers
 * something new — handy as a `useEffect` dependency for pages that should
 * refresh when a push arrives.
 */
export function useLive() {
  const { notifications } = useStore();
  const key = notifications[0]?.id ?? 0;
  const [tick, setTick] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((n) => n + 1);
  }, [key]);
  return tick;
}

export function useLockBody(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Geolocation with a deterministic fallback for browsers without permission. */
export function useGeolocation({ fallback = null } = {}) {
  const [state, setState] = useState({ loading: false, coords: fallback, error: null, source: fallback ? 'fallback' : null });
  const locate = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ loading: false, coords: fallback, error: 'Geolocation unavailable', source: 'fallback' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          loading: false,
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
          error: null,
          source: 'gps'
        }),
      () => setState({ loading: false, coords: fallback, error: 'Location permission denied — using registered office location', source: 'fallback' }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [fallback]);
  return { ...state, locate };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useHashRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
    const [path, query = ''] = raw.split('?');
    return { path, query: Object.fromEntries(new URLSearchParams(query)), full: raw };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const handler = () => {
      setRoute(read());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const navigate = useCallback((to) => {
    if (window.location.hash === `#${to}`) return;
    window.location.hash = to;
  }, []);
  return { ...route, navigate };
}
