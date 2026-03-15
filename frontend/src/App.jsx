import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';
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
    // Apply Cloudscape Runtime Theme
    applyTheme({
      theme: {
        tokens: {
          // Clean up dark mode: pure black backgrounds or transparent
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
          
          // Remove dark blue from hover and active states
          colorBackgroundButtonNormalHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundButtonNormalActive: { light: '#f5f5f5', dark: '#1a1a1a' },
          colorBackgroundDropdownItemHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundSegmentDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundSegmentHover: { light: '#fafafa', dark: '#111111' },
          
          // Dropzone backgrounds
          colorBackgroundDropzoneDefault: { light: '#ffffff', dark: 'transparent' },
          colorBackgroundDropzoneHover: { light: '#fafafa', dark: '#111111' },
          colorBackgroundDropzoneActive: { light: '#f5f5f5', dark: '#1a1a1a' },
        },
        contexts: {
          'top-navigation': {
            tokens: {
              // Force top-nav to be purely black in all modes
              colorBackgroundContainerHeader: '#000000',
              colorBackgroundLayoutMain: '#000000',
              colorTextBodyDefault: '#ffffff',
              colorTextHeadingDefault: '#ffffff',
              colorTextInteractiveDefault: '#ffffff',
              colorTextInteractiveHover: '#aab7b8',
            }
          }
        }
      }
    });
  }, []);

  const crumbs = BREADCRUMB_MAP[location.pathname] || BREADCRUMB_MAP['/dashboard'];

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <>
      <div id="top-nav" style={{ position: 'sticky', top: 0, zIndex: 1001 }}>
        <TopNavigation
          identity={{ href: '/', title: '', logo: { src: logo, alt: 'AI AutoFill' } }}
          utilities={[
            {
              type: 'button',
              text: 'Launch AutoFill',
              iconName: 'upload',
              onClick: () => navigate('/autofill'),
            },
            {
              type: 'button',
              text: theme === 'dark' ? 'Dark Mode' : 'Light Mode',
              iconName: theme === 'dark' ? 'zoom-in' : 'zoom-out', // Using icons as proxies or finding a better way
              iconSvg: theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              ),
              ariaLabel: 'Toggle Theme',
              onClick: toggleTheme,
            },
            { type: 'menu-dropdown', text: 'User', iconName: 'user-profile', items: [{ id: 'profile', text: 'Profile Setup' }] },
          ]}
        />
      </div>
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
