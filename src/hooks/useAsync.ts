import { useEffect, useState, type DependencyList } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error; retry: () => void }
  | { status: 'success'; data: T };

/** Ejecuta una promesa y expone su estado; ignora respuestas de efectos ya desmontados. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fn().then(
      (data) => alive && setState({ status: 'success', data }),
      (e: unknown) => alive && setState({
        status: 'error',
        error: e instanceof Error ? e : new Error(String(e)),
        retry: () => setAttempt((n) => n + 1),
      }),
    );
    return () => { alive = false; };
  }, [...deps, attempt]);

  return state;
}
