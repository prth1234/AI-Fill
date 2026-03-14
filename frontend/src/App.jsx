import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@cloudscape-design/components/app-layout';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import ProfileSetupPage from './pages/ProfileSetupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AutoFillPage from './pages/AutoFillPage.jsx';
import JobsPage from './pages/JobsPage.jsx';

const NAV_ITEMS = [
  { type: 'link', text: '🏠 Dashboard', href: '/' },
  { type: 'divider' },
  {
    type: 'section',
    text: 'Profile Setup',
    items: [
      { type: 'link', text: 'Personal Info', href: '/profile#personal' },
      { type: 'link', text: 'Work Experience', href: '/profile#experience' },
      { type: 'link', text: 'Education', href: '/profile#education' },
      { type: 'link', text: 'Skills & Tech', href: '/profile#skills' },
      { type: 'link', text: 'Certifications', href: '/profile#certifications' },
      { type: 'link', text: 'Projects', href: '/profile#projects' },
      { type: 'link', text: 'Preferences', href: '/profile#preferences' },
    ],
  },
  { type: 'divider' },
  {
    type: 'section',
    text: 'AI AutoFill',
    items: [
      { type: 'link', text: 'Launch AutoFill', href: '/autofill' },
      { type: 'link', text: 'Job History', href: '/jobs' },
    ],
  },
];

function getBreadcrumbs(pathname) {
  const map = {
    '/': [{ text: 'AI AutoFill', href: '/' }],
    '/profile': [{ text: 'AI AutoFill', href: '/' }, { text: 'Profile Setup', href: '/profile' }],
    '/autofill': [{ text: 'AI AutoFill', href: '/' }, { text: 'Launch AutoFill', href: '/autofill' }],
    '/jobs': [{ text: 'AI AutoFill', href: '/' }, { text: 'Job History', href: '/jobs' }],
  };
  return map[pathname] || map['/'];
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(true);

  return (
    <>
      <TopNavigation
        identity={{
          href: '/',
          title: 'AI AutoFill',
          logo: {
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%230972d3'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='Arial' font-weight='bold'%3EAI%3C/text%3E%3C/svg%3E",
            alt: 'AI AutoFill',
          },
        }}
        utilities={[
          {
            type: 'button',
            text: 'Launch AutoFill',
            iconName: 'upload',
            onClick: () => navigate('/autofill'),
          },
          {
            type: 'menu-dropdown',
            text: 'User',
            iconName: 'user-profile',
            items: [
              { id: 'profile', text: 'My Profile', href: '/profile' },
              { id: 'settings', text: 'Settings' },
              { id: 'signout', text: 'Sign out' },
            ],
          },
        ]}
        i18nStrings={{ overflowMenuTriggerText: 'More' }}
      />
      <AppLayout
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            header={{ text: 'Navigation', href: '/' }}
            items={NAV_ITEMS}
            onFollow={(e) => {
              e.preventDefault();
              const href = e.detail.href;
              if (href.includes('#')) {
                const [path] = href.split('#');
                navigate(href.includes('/profile') ? `/profile${href.split('/profile')[1]}` : path);
              } else {
                navigate(href);
              }
            }}
          />
        }
        breadcrumbs={
          <BreadcrumbGroup
            items={getBreadcrumbs(location.pathname)}
            onFollow={(e) => { e.preventDefault(); navigate(e.detail.href); }}
          />
        }
        navigationOpen={navOpen}
        onNavigationChange={({ detail }) => setNavOpen(detail.open)}
        toolsHide
        content={
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfileSetupPage />} />
            <Route path="/autofill" element={<AutoFillPage />} />
            <Route path="/jobs" element={<JobsPage />} />
          </Routes>
        }
      />
    </>
  );
}
