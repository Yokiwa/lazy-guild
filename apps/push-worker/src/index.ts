import { runDispatch } from './dispatch';
import type { Env } from './env';
import { createWebPushSender } from './push';
import { handleRequest } from './routes';

export default {
  fetch: (req: Request, env: Env) => handleRequest(req, env),
  scheduled(event, env, ctx) {
    ctx.waitUntil(runDispatch(env, new Date(event.scheduledTime), createWebPushSender(env)));
  },
} satisfies ExportedHandler<Env>;
