import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { Layout } from './components/Layout';
import Choose from './pages/Choose';
import Confirm from './pages/Confirm';
import Hall from './pages/Hall';
import Onboarding from './pages/Onboarding';
import Plan from './pages/Plan';
import Profile from './pages/Profile';
import Quests from './pages/Quests';
import Run from './pages/Run';
import Settings from './pages/Settings';
import Shop from './pages/Shop';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/onboarding', element: <Onboarding /> },
      { path: '/', element: <Hall /> },
      { path: '/choose', element: <Choose /> },
      { path: '/run', element: <Run /> },
      { path: '/confirm', element: <Confirm /> },
      { path: '/plan', element: <Plan /> },
      { path: '/quests', element: <Quests /> },
      { path: '/profile', element: <Profile /> },
      { path: '/shop', element: <Shop /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <Hall /> },
    ],
  },
];

export function App() {
  return <RouterProvider router={createBrowserRouter(routes)} />;
}

/** For component tests. */
export function TestApp({ path }: { path: string }) {
  return <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />;
}
