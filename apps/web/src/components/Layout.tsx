import { useLiveQuery } from 'dexie-react-hooks';
import type { Profile } from '@lazy-guild/core';
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import { TabBar } from './TabBar';

/**
 * Redirects to onboarding until a profile exists; shows the tab bar on main pages.
 * (Onboarding itself leaves when a profile already exists, so finishing it can choose its own next page.)
 */
export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const profile = useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
  if (profile === undefined) return <div className="loading">{t('app.loading')}</div>;
  const onOnboarding = location.pathname.startsWith('/onboarding');
  if (!profile && !onOnboarding) return <Navigate to="/onboarding" replace />;
  const hideTabs = onOnboarding || ['/choose', '/run', '/confirm'].some((p) => location.pathname.startsWith(p));
  return (
    <div className={hideTabs ? 'shell' : 'shell with-tabs'}>
      <main>
        <Outlet context={{ profile } satisfies LayoutContext} />
      </main>
      {!hideTabs && <TabBar />}
    </div>
  );
}

export interface LayoutContext {
  profile: Profile | null;
}

/** The profile exactly as the Layout sees it, so pages never race the Layout's redirects. */
export function useLayoutProfile(): Profile | null {
  return useOutletContext<LayoutContext>().profile;
}
