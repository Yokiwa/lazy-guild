import type { Env } from './env';
import { handleRequest } from './routes';

export default {
  fetch: (req: Request, env: Env) => handleRequest(req, env),
} satisfies ExportedHandler<Env>;
