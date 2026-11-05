import { handleNotificationClick, handlePush } from '../src/sw-handlers';

test('push shows the payload as a notification', async () => {
  const showNotification = vi.fn(async () => {});
  await handlePush(
    { title: '⚔️ 新的委托到了！', body: '点开挑一个吧', url: '/choose?slot=a&date=2026-11-09', tag: 'slot:a@2026-11-09', kind: 'slot' },
    { showNotification },
  );
  expect(showNotification).toHaveBeenCalledWith('⚔️ 新的委托到了！', expect.objectContaining({
    body: '点开挑一个吧', tag: 'slot:a@2026-11-09', data: { url: '/choose?slot=a&date=2026-11-09' },
  }));
});

test('push with unreadable payload still shows a generic notification', async () => {
  const showNotification = vi.fn(async () => {});
  await handlePush(null, { showNotification });
  expect(showNotification).toHaveBeenCalledWith('Lazy Guild · 懒人公会', expect.objectContaining({ data: { url: '/' } }));
});

test('notificationclick focuses existing client and navigates', async () => {
  const client = { url: 'https://app.example/', focus: vi.fn(async () => client), navigate: vi.fn(async () => client) };
  const clients = { matchAll: vi.fn(async () => [client]), openWindow: vi.fn() };
  const close = vi.fn();
  await handleNotificationClick({ notification: { data: { url: '/confirm?run=r1' }, close } }, clients, 'https://app.example');
  expect(close).toHaveBeenCalled();
  expect(client.focus).toHaveBeenCalled();
  expect(client.navigate).toHaveBeenCalledWith('https://app.example/confirm?run=r1');
  expect(clients.openWindow).not.toHaveBeenCalled();
});

test('notificationclick opens a window when none exists, and ignores foreign urls', async () => {
  const clients = { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) };
  await handleNotificationClick({ notification: { data: { url: 'https://evil.example/x' }, close: vi.fn() } }, clients, 'https://app.example');
  expect(clients.openWindow).toHaveBeenCalledWith('https://app.example/');
});

test('#9 falls back to opening a window when navigate() rejects', async () => {
  const client = { url: 'https://app.example/', focus: vi.fn(async () => client), navigate: vi.fn(async () => { throw new TypeError('not controlled'); }) };
  const clients = { matchAll: vi.fn(async () => [client]), openWindow: vi.fn(async () => null) };
  await handleNotificationClick({ notification: { data: { url: '/confirm?run=r1' }, close: vi.fn() } }, clients, 'https://app.example');
  expect(clients.openWindow).toHaveBeenCalledWith('https://app.example/confirm?run=r1');
});
