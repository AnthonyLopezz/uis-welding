import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  BarChart3, BookCheck, Compass, FolderOpen, GraduationCap, Home, Menu, RotateCcw, Search, Settings2, X, ClipboardCheck,
} from 'lucide-react';
import { useProgress } from '../store/ProgressContext.tsx';
import type { Theme } from '../types/progress.ts';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/categorias', label: 'Categorías', icon: FolderOpen },
  { to: '/explorar', label: 'Explorar temas', icon: Compass },
  { to: '/preguntas', label: 'Banco de preguntas', icon: BookCheck },
  { to: '/repaso', label: 'Repaso', icon: RotateCcw },
  { to: '/evaluacion', label: 'Evaluación', icon: ClipboardCheck },
  { to: '/progreso', label: 'Mi progreso', icon: BarChart3 },
];

/** Navegación inferior en móvil: las 5 acciones más usadas al alcance del pulgar. */
const TABS = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/explorar', label: 'Temas', icon: Compass },
  { to: '/preguntas', label: 'Preguntas', icon: BookCheck },
  { to: '/repaso', label: 'Repaso', icon: RotateCcw },
  { to: '/progreso', label: 'Progreso', icon: BarChart3 },
];

function TabBar() {
  return (
    <nav className="tabbar only-mobile" aria-label="Accesos rápidos">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          <Icon size={22} aria-hidden /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="nav">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink to={to} end={end} onClick={onNavigate} className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}>
            <Icon size={20} aria-hidden /> {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function SearchBar({ autoFocus, onSearch }: { autoFocus?: boolean; onSearch?: () => void }) {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const navigate = useNavigate();
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/buscar?q=${encodeURIComponent(q.trim())}`);
    onSearch?.();
  };
  return (
    <form role="search" className="search-bar" onSubmit={submit}>
      <label htmlFor="global-search" className="sr-only">Buscar contenido</label>
      <Search size={18} aria-hidden className="search-bar__icon" />
      <input id="global-search" type="search" placeholder="Buscar temas, conceptos, imágenes…" value={q}
        onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} />
    </form>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

function PreferencesMenu() {
  const { state, setTheme } = useProgress();
  return (
    <>
      <button className="icon-btn" popoverTarget="prefs" aria-label="Preferencias">
        <Settings2 aria-hidden />
      </button>
      <div id="prefs" popover="auto" className="popover">
        <fieldset>
          <legend>Tema de color</legend>
          {THEMES.map((t) => (
            <label key={t.value} className="radio-line">
              <input type="radio" name="theme" checked={(state.preferences.theme === 'dark') === (t.value === 'dark')} onChange={() => setTheme(t.value)} />
              {t.label}
            </label>
          ))}
        </fieldset>
        <Link to="/progreso#reiniciar" className="popover__link">Gestionar mi progreso</Link>
      </div>
    </>
  );
}

function MobileMenu() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button className="icon-btn only-mobile" onClick={() => ref.current?.showModal()} aria-label="Abrir menú">
        <Menu aria-hidden />
      </button>
      <dialog ref={ref} className="drawer" aria-label="Menú principal" onClick={(e) => e.target === e.currentTarget && close()}>
        <div className="drawer__head">
          <span className="brand"><GraduationCap aria-hidden /> UIS Learning</span>
          <button className="icon-btn" onClick={close} aria-label="Cerrar menú"><X aria-hidden /></button>
        </div>
        <SearchBar onSearch={close} />
        <nav aria-label="Principal"><NavLinks onNavigate={close} /></nav>
      </dialog>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // Al cambiar de ruta: arriba del todo y foco al contenido (lectores de pantalla anuncian la nueva página).
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <header className="header">
        <MobileMenu />
        <Link to="/" className="brand"><GraduationCap aria-hidden /> <span>UIS Learning</span><small>Soldadura</small></Link>
        <div className="header__search only-desktop"><SearchBar /></div>
        <div className="header__actions">
          <Link to="/buscar" className="icon-btn only-mobile" aria-label="Buscar"><Search aria-hidden /></Link>
          <Link to="/progreso" className="btn btn--ghost btn--sm only-desktop"><BarChart3 size={18} aria-hidden /> Progreso</Link>
          <PreferencesMenu />
        </div>
      </header>
      <aside className="sidebar only-desktop">
        <nav aria-label="Principal"><NavLinks /></nav>
      </aside>
      <main id="main" ref={mainRef} tabIndex={-1} className="main">{children}</main>
      <TabBar />
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </header>
  );
}
