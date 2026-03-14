import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Icon from '@cloudscape-design/components/icon';

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

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(true);

  const crumbs = BREADCRUMB_MAP[location.pathname] || BREADCRUMB_MAP['/dashboard'];

  return (
    <>
      <div id="top-nav" style={{ position: 'sticky', top: 0, zIndex: 1001 }}>
        <TopNavigation
          identity={{ href: '/', title: 'AI AutoFill', logo: { alt: 'AI AutoFill' } }}
          utilities={[
            {
              type: 'button',
              text: 'Launch AutoFill',
              iconName: 'upload',
              onClick: () => navigate('/autofill'),
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
            header={{ text: 'Navigation', href: '/dashboard' }}
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
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile/*" element={<ProfileSetupPage />} />
            <Route path="/autofill" element={<AutoFillPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/custom" element={<CustomProfilePage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
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
