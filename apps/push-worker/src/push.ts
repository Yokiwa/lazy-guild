import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { VapidKeys } from './vapid';

export interface NotificationPayload {
  kind: 'slot' | 'confirm';
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSender {
  send(sub: PushTarget, payload: NotificationPayload): Promise<{ status: number }>;
}

export function createWebPushSender(vapid: VapidKeys): PushSender {
  return {
    async send(sub, payload) {
      const req = await buildPushPayload(
        { data: JSON.stringify(payload), options: { ttl: 3600, topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } },
        { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        vapid,
      );
      const res = await fetch(sub.endpoint, req);
      return { status: res.status };
    },
  };
}
