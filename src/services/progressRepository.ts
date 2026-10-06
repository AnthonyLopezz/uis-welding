// Persistencia del progreso detrás de una interfaz: la app no conoce localStorage.
// Para usar un backend basta con implementar ProgressRepository (p. ej. ApiProgressRepository
// con fetch a import.meta.env.VITE_API_URL) y cambiar la instancia exportada abajo.
import { emptyProgress, type ProgressState } from '../types/progress.ts';

export interface ProgressRepository {
  load(): Promise<ProgressState>;
  save(state: ProgressState): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'uis-learning:progress:v1';

export class LocalStorageProgressRepository implements ProgressRepository {
  async load(): Promise<ProgressState> {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<ProgressState>) : null;
      // Datos corruptos o de otra versión → se empieza de cero en vez de romper la app.
      return parsed?.version === 1 ? { ...emptyProgress(), ...parsed } as ProgressState : emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  async save(state: ProgressState): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Almacenamiento lleno o bloqueado (modo privado): el progreso sigue en memoria durante la sesión.
    }
  }

  async clear(): Promise<void> {
    try { localStorage.removeItem(KEY); } catch { /* sin acceso a almacenamiento */ }
  }
}

export const progressRepository: ProgressRepository = new LocalStorageProgressRepository();
