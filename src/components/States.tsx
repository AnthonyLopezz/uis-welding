import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Inbox, Loader2, SearchX } from 'lucide-react';
import type { AsyncState } from '../hooks/useAsync.ts';

export function LoadingState({ label = 'Cargando contenido…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <Loader2 className="spin" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

interface EmptyProps { title: string; message?: string; action?: ReactNode; icon?: 'empty' | 'search' }

export function EmptyState({ title, message, action, icon = 'empty' }: EmptyProps) {
  const Icon = icon === 'search' ? SearchX : Inbox;
  return (
    <div className="state">
      <Icon aria-hidden />
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle aria-hidden />
      <h2>No se pudo cargar el contenido</h2>
      <p>{message}</p>
      {retry && <button className="btn btn--primary" onClick={retry}>Reintentar</button>}
    </div>
  );
}

export function NotFoundState({ what = 'La página' }: { what?: string }) {
  return (
    <EmptyState
      icon="search"
      title={`${what} no existe`}
      message="Puede que el enlace esté incompleto o que el contenido haya cambiado."
      action={<Link className="btn btn--primary" to="/">Volver al inicio</Link>}
    />
  );
}

/** Renderiza loading / error / éxito; si el dato es undefined muestra "no encontrado". */
export function AsyncView<T>({ state, children, notFound }: { state: AsyncState<T | undefined>; children: (data: T) => ReactNode; notFound?: string }) {
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'error') return <ErrorState message={state.error.message} retry={state.retry} />;
  if (state.data === undefined) return <NotFoundState what={notFound} />;
  return <>{children(state.data)}</>;
}
