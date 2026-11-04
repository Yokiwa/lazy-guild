import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { Env } from './env';

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

export function createWebPushSender(env: Env): PushSender {
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
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
