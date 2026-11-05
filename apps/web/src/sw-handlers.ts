/** Service-worker event logic, kept free of `self` so it can be unit-tested. */
export interface PushPayload {
  kind: 'slot' | 'confirm';
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface Registrationish {
  showNotification(title: string, options: NotificationOptions): Promise<void>;
}
interface Clientish {
  url: string;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<unknown>;
}
interface Clientsish {
  matchAll(options?: ClientQueryOptions): Promise<readonly Clientish[]>;
  openWindow(url: string): Promise<unknown>;
}

export async function handlePush(payload: PushPayload | null, registration: Registrationish): Promise<void> {
  const title = payload?.title ?? 'Lazy Guild · 懒人公会';
  await registration.showNotification(title, {
    body: payload?.body ?? '',
    tag: payload?.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload?.url ?? '/' },
  });
}

/** Only same-origin paths are followed; anything else opens the app's home. */
function safeTarget(raw: unknown, origin: string): string {
  try {
    const url = new URL(String(raw ?? '/'), origin);
    return url.origin === origin ? url.href : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}

export async function handleNotificationClick(
  event: { notification: { data?: { url?: string }; close(): void } },
  clients: Clientsish,
  origin: string,
): Promise<void> {
  event.notification.close();
  const target = safeTarget(event.notification.data?.url, origin);
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find((c) => c.url.startsWith(origin));
  if (existing) {
    await existing.focus();
    await existing.navigate(target);
    return;
  }
  await clients.openWindow(target);
}
