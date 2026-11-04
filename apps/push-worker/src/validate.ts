import { z } from 'zod';

export const MAX_BODY_BYTES = 16 * 1024;

const tz = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
});

export const SubscriptionBody = z.object({
  endpoint: z.url({ protocol: /^https$/ }),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
});

export const DeviceBody = z.object({
  subscription: SubscriptionBody,
  tz,
  lang: z.enum(['zh', 'en']),
});

export const SlotsBody = z.object({
  slots: z
    .array(
      z.object({
        slotId: z.string().min(1).max(64),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .max(42),
});

export const OneOffBody = z.object({
  at: z.iso.datetime({ offset: true }),
  kind: z.literal('confirm'),
  runId: z.string().min(1).max(64),
});

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid json');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'invalid body');
  return parsed.data;
}
