import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TABS = [
  { to: '/', key: 'hall', icon: '🏰' },
  { to: '/plan', key: 'plan', icon: '🗓️' },
  { to: '/quests', key: 'quests', icon: '📜' },
  { to: '/profile', key: 'profile', icon: '🛡️' },
  { to: '/settings', key: 'settings', icon: '⚙️' },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="tabbar" aria-label="main">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <span aria-hidden="true">{tab.icon}</span>
          <span>{t(`nav.${tab.key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
