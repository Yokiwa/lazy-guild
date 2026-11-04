import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import { TabBar } from './TabBar';

/** Redirects to onboarding until a profile exists; shows the tab bar on main pages. */
export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const profile = useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
  if (profile === undefined) return <div className="loading">{t('app.loading')}</div>;
  const onOnboarding = location.pathname.startsWith('/onboarding');
  if (!profile && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (profile && onOnboarding) return <Navigate to="/" replace />;
  const hideTabs = onOnboarding || ['/choose', '/run', '/confirm'].some((p) => location.pathname.startsWith(p));
  return (
    <div className={hideTabs ? 'shell' : 'shell with-tabs'}>
      <main>
        <Outlet />
      </main>
      {!hideTabs && <TabBar />}
    </div>
  );
}
