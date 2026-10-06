// Única fuente de verdad del progreso y las preferencias. Persiste a través de ProgressRepository.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { progressReducer } from '../services/learning.ts';
import { progressRepository } from '../services/progressRepository.ts';
import { emptyProgress, type ProgressState, type Theme } from '../types/progress.ts';
import type { Question } from '../types/question.ts';
import { LoadingState } from '../components/States.tsx';

interface ProgressApi {
  state: ProgressState;
  visitStep: (topicId: string, stepId: string, totalSteps: number) => void;
  completeTopic: (topicId: string) => void;
  recordAnswer: (question: Question, correct: boolean) => void;
  setTheme: (theme: Theme) => void;
  reset: () => void;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(progressReducer, undefined, emptyProgress);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    progressRepository.load().then((s) => {
      dispatch({ type: 'replace', state: s });
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) progressRepository.save(state);
  }, [state]);

  useEffect(() => {
    // Claro por defecto; el oscuro solo si el usuario lo elige.
    document.documentElement.dataset.theme = state.preferences.theme === 'dark' ? 'dark' : 'light';
  }, [state.preferences]);

  const visitStep = useCallback((topicId: string, stepId: string, totalSteps: number) =>
    dispatch({ type: 'visitStep', topicId, stepId, totalSteps, now: new Date() }), []);
  const completeTopic = useCallback((topicId: string) => dispatch({ type: 'completeTopic', topicId, now: new Date() }), []);
  const recordAnswer = useCallback((question: Question, correct: boolean) =>
    dispatch({ type: 'answer', question, correct, now: new Date() }), []);
  const setTheme = useCallback((theme: Theme) => dispatch({ type: 'setTheme', theme }), []);
  const reset = useCallback(() => {
    progressRepository.clear();
    dispatch({ type: 'replace', state: { ...emptyProgress(), preferences: state.preferences } });
  }, [state.preferences]);

  const api = useMemo(
    () => ({ state, visitStep, completeTopic, recordAnswer, setTheme, reset }),
    [state, visitStep, completeTopic, recordAnswer, setTheme, reset],
  );

  return <Ctx.Provider value={api}>{ready ? children : <LoadingState />}</Ctx.Provider>;
}

export function useProgress(): ProgressApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProgress debe usarse dentro de ProgressProvider');
  return ctx;
}
