import { Outlet, ScrollRestoration } from 'react-router';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { InkSplash } from '../diary/InkSplash';

export function Root() {
  useAdminNotifications();
  return (
    <>
      <InkSplash />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
