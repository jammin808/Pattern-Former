import { z } from 'zod';
import { HttpError, json, readBody, route } from '../../lib/http.js';
import { startSession, verifyGoogleCredential } from '../../lib/auth.js';
import { upsertUser } from '../../lib/db.js';
import { describeAccount } from '../../lib/account.js';

const bodySchema = z.object({ credential: z.string().min(20).max(4096) }).strict();

// Exchanges a Google Identity Services ID token for a session cookie.
export default route({
  async POST(req, res) {
    const parsed = bodySchema.safeParse(await readBody(req));
    if (!parsed.success) throw new HttpError(400, 'Missing Google credential.');
    const user = await upsertUser(await verifyGoogleCredential(parsed.data.credential));
    await startSession(res, user.id);
    json(res, 200, await describeAccount(user));
  },
});
