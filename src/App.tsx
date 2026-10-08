import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/Layout.tsx';
import { ErrorState, LoadingState, NotFoundState } from './components/States.tsx';

// Code splitting por ruta: el dashboard no descarga el código de estudio, evaluación, etc.
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Categories = lazy(() => import('./pages/Categories.tsx'));
const CategoryPage = lazy(() => import('./pages/CategoryPage.tsx'));
const Explore = lazy(() => import('./pages/Explore.tsx'));
const TopicPage = lazy(() => import('./pages/TopicPage.tsx'));
const Study = lazy(() => import('./pages/Study.tsx'));
const QuestionPage = lazy(() => import('./pages/QuestionPage.tsx'));
const Review = lazy(() => import('./pages/Review.tsx'));
const Exam = lazy(() => import('./pages/Exam.tsx'));
const Progress = lazy(() => import('./pages/Progress.tsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.tsx'));
const QuestionBank = lazy(() => import('./pages/QuestionBank.tsx'));
const Parciales = lazy(() => import('./pages/Parciales.tsx'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error
      ? <ErrorState message="Ocurrió un error inesperado en esta pantalla." retry={() => location.reload()} />
      : this.props.children;
  }
}

export function App() {
  const { pathname } = useLocation();
  return (
    <AppShell>
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/categoria/:id" element={<CategoryPage />} />
            <Route path="/explorar" element={<Explore />} />
            <Route path="/tema/:id" element={<TopicPage />} />
            <Route path="/estudiar/:id" element={<Study />} />
            <Route path="/pregunta/:id" element={<QuestionPage />} />
            <Route path="/repaso" element={<Review />} />
            <Route path="/evaluacion" element={<Exam />} />
            <Route path="/progreso" element={<Progress />} />
            <Route path="/buscar" element={<SearchPage />} />
            <Route path="/preguntas" element={<QuestionBank />} />
            <Route path="/parciales" element={<Parciales />} />
            <Route path="/parciales/:id" element={<Parciales />} />
            <Route path="*" element={<NotFoundState />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
