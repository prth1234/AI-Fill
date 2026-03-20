import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@cloudscape-design/components/app-layout';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Icon from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import logo from './assets/query-pilot-logo.png';
import { applyMode, Mode } from '@cloudscape-design/global-styles';
import { applyTheme } from '@cloudscape-design/components/theming';


import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import AutoFillPage from './pages/AutoFillPage';
import JobsPage from './pages/JobsPage';
import CustomProfilePage from './pages/CustomProfilePage';
import AIAssistant from './components/AIAssistant';

const NAV_ITEMS = [
  { type: 'link', text: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="menu" /> <span>Dashboard</span></span>, href: '/dashboard' },
  { type: 'divider' },
  { type: 'link', text: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="user-profile" /> <span>Profile Setup</span></span>, href: '/profile' },
  { type: 'divider' },
  {
    type: 'section',
    text: 'AI AutoFill',
    items: [
      { type: 'link', text: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="upload" /> <span>Launch AutoFill</span></span>,  href: '/autofill' },
      { type: 'link', text: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="filter" /> <span>Job History</span></span>,      href: '/jobs' },
      { type: 'link', text: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="settings" /> <span>Custom Profile</span></span>,   href: '/custom' },
    ],
  },
];

const BREADCRUMB_MAP = {
  '/dashboard':           [{ text: 'AI AutoFill', href: '/' }, { text: 'Dashboard',       href: '/dashboard' }],
  '/profile':             [{ text: 'AI AutoFill', href: '/' }, { text: 'Profile Setup',   href: '/profile' }],
  '/autofill':            [{ text: 'AI AutoFill', href: '/' }, { text: 'Launch AutoFill', href: '/autofill' }],
  '/jobs':                [{ text: 'AI AutoFill', href: '/' }, { text: 'Job History',      href: '/jobs' }],
  '/custom':              [{ text: 'AI AutoFill', href: '/' }, { text: 'Custom Profile',  href: '/custom' }],
};

function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch { return defaultValue; }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
}


function GlassHeader({ theme, onToggleTheme, onNavigate }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const isDark = theme === 'dark';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div id="top-nav" className={`glass-header ${isDark ? 'glass-dark' : 'glass-light'}`}>
      {/* Logo / Brand */}
      <button
        className="glass-nav-brand"
        onClick={() => onNavigate('/')}
        aria-label="Go to home"
      >
        <img src={logo} alt="AI AutoFill" className="glass-nav-logo" />
        <span className="glass-nav-title">AI AutoFill</span>
      </button>

      {/* Right-side utilities */}
      <div className="glass-nav-utils">
        {/* Launch AutoFill */}
        <button
          className="glass-nav-btn"
          onClick={() => onNavigate('/autofill')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Launch AutoFill
        </button>

        {/* Theme Toggle */}
        <button
          className="glass-nav-btn glass-nav-btn--icon"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={isDark ? 'Dark Mode' : 'Light Mode'}
        >
          {isDark ? (
            // Sun icon
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            // Moon icon
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        {/* User dropdown */}
        <div className="glass-nav-user-wrap" ref={userMenuRef}>
          <button
            className="glass-nav-btn glass-nav-btn--user"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            User
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {userMenuOpen && (
            <div className="glass-nav-dropdown">
              <button
                className="glass-nav-dropdown-item"
                onClick={() => { setUserMenuOpen(false); onNavigate('/profile'); }}
              >
                Profile Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = usePersistedState('app_theme', 'system');

  useEffect(() => {
    if (theme === 'dark') applyMode(Mode.Dark);
    else if (theme === 'light') applyMode(Mode.Light);
    else applyMode(Mode.System);
  }, [theme]);

  useEffect(() => {
    // Apply Cloudscape Runtime Theme (no top-navigation context needed — we use custom header)
    applyTheme({
      theme: {
        tokens: {
          colorBackgroundLayoutMain: { light: '#ffffff', dark: '#000000' },
          colorBackgroundLayoutNav: { light: '#ffffff', dark: '#000000' },
          colorBackgroundLayoutTools: { light: '#ffffff', dark: '#000000' },
          colorBackgroundContainerContent: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundContainerHeader: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundLayoutPanelContent: { light: '#ffffff', dark: '#000000' },
          colorBackgroundInputDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundButtonNormalDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundDropdownItemDefault: { light: '#ffffff', dark: '#000000' },
          colorBackgroundPopover: { light: '#ffffff', dark: '#000000' },
          colorBackgroundButtonNormalHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundButtonNormalActive: { light: '#f5f5f5', dark: '#1a1a1a' },
          colorBackgroundDropdownItemHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundSegmentDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundSegmentHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundDropzoneDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundDropzoneHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundDropzoneActive: { light: '#f5f5f5', dark: '#1a1a1a' },
        },
      }
    });
  }, []);

  const crumbs = BREADCRUMB_MAP[location.pathname] || BREADCRUMB_MAP['/dashboard'];

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <>
      <GlassHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navigate}
      />
      <AppLayout
        headerSelector="#top-nav"
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            header={{ text: 'AI AutoFill Agent', href: '/dashboard' }}
            onFollow={e => { e.preventDefault(); navigate(e.detail.href); }}
            items={NAV_ITEMS}
          />
        }
        breadcrumbs={
          <BreadcrumbGroup
            items={crumbs}
            onFollow={e => { e.preventDefault(); navigate(e.detail.href); }}
          />
        }
        content={
          isLoading ? (
            <Box padding="xxl" textAlign="center">
              <SpaceBetween size="m">
                <Spinner size="large" />
                <Box variant="h3">Preparing your workspace...</Box>
              </SpaceBetween>
            </Box>
          ) : (
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile/*" element={<ProfileSetupPage />} />
              <Route path="/autofill" element={<AutoFillPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/custom" element={<CustomProfilePage />} />
              <Route path="*" element={<DashboardPage />} />
            </Routes>
          )
        }
        toolsHide
      />
      {/* Global AI Assistant — floats on all pages */}
      <AIAssistant />
    </>
  );
}


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
