import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { RequireAdmin, RequireAuth } from './components/auth/Guards';
import { AdminLayout } from './components/layout/AdminLayout';
import { Root } from './components/layout/Root';
import { SiteLayout } from './components/layout/SiteLayout';
import AccountPage from './pages/AccountPage';
import ArchivePage from './pages/ArchivePage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import CommunityPage from './pages/CommunityPage';
import ErrorPage from './pages/ErrorPage';
import HomePage from './pages/HomePage';
import LogPage from './pages/LogPage';
import NotFoundPage from './pages/NotFoundPage';
import ShareStoryPage from './pages/ShareStoryPage';
import { SubscribeConfirmPage, UnsubscribePage } from './pages/SubscriptionPages';

/** Admin screens are code-split: readers never download the writing desk. */
const admin = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'logs', element: <ArchivePage /> },
          { path: 'logs/:slug', element: <LogPage /> },
          { path: 'community', element: <CommunityPage /> },
          { path: 'share-your-story', element: <ShareStoryPage /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
          {
            path: 'account',
            element: (
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            ),
          },
          { path: 'subscribe/confirm', element: <SubscribeConfirmPage /> },
          { path: 'unsubscribe', element: <UnsubscribePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, lazy: admin(() => import('./pages/admin/DashboardPage')) },
          { path: 'logs', lazy: admin(() => import('./pages/admin/LogsPage')) },
          { path: 'logs/:id', lazy: admin(() => import('./pages/admin/LogEditorPage')) },
          { path: 'stories', lazy: admin(() => import('./pages/admin/StoriesPage')) },
          { path: 'comments', lazy: admin(() => import('./pages/admin/CommentsPage')) },
          { path: 'tags', lazy: admin(() => import('./pages/admin/TagsPage')) },
          { path: 'subscribers', lazy: admin(() => import('./pages/admin/SubscribersPage')) },
          { path: 'history', lazy: admin(() => import('./pages/admin/HistoryPage')) },
        ],
      },
    ],
  },
]);
