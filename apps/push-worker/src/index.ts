import { runDispatch } from './dispatch';
import type { Env } from './env';
import { createWebPushSender } from './push';
import { handleRequest } from './routes';
import { getVapidKeys } from './vapid';

export default {
  fetch: (req: Request, env: Env) => handleRequest(req, env),
  scheduled(event, env, ctx) {
    ctx.waitUntil(
      getVapidKeys(env).then((keys) => runDispatch(env, new Date(event.scheduledTime), createWebPushSender(keys))),
    );
  },
} satisfies ExportedHandler<Env>;
