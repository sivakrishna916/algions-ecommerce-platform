import { useCallback, useEffect, useRef, useState } from 'react';

/** Small data-loading hook: { data, loading, error, reload }. Ignores stale responses when deps change. */
export default function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then(
      (data) => { if (id === seq.current) setState({ data, loading: false, error: null }); return data; },
      (error) => { if (id === seq.current) setState({ data: null, loading: false, error }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
