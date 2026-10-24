import { z } from 'zod';
import { HttpError, json, readBody, route } from '../lib/http.js';
import { isAdmin, requireAdmin } from '../lib/auth.js';
import { defaultMonthlyLimit, listUsersWithUsage, setDefaultMonthlyLimit, updateUser } from '../lib/db.js';

const MAX_LIMIT = 1_000_000_000;
const userPatchSchema = z.object({
  id: z.uuid(),
  status: z.enum(['active', 'blocked']).optional(),
  // null resets the user to the default limit
  monthly_token_limit: z.number().int().min(0).max(MAX_LIMIT).nullable().optional(),
}).strict();
const settingsSchema = z.object({ defaultMonthlyTokenLimit: z.number().int().min(0).max(MAX_LIMIT) }).strict();

export default route({
  async GET(req, res) {
    await requireAdmin(req);
    const [users, defaultLimit] = await Promise.all([listUsersWithUsage(), defaultMonthlyLimit()]);
    json(res, 200, { defaultMonthlyTokenLimit: defaultLimit, users: users.map(u => ({ ...u, isAdmin: isAdmin(u.email) })) });
  },
  async PATCH(req, res) {
    const admin = await requireAdmin(req);
    const parsed = userPatchSchema.safeParse(await readBody(req));
    if (!parsed.success) throw new HttpError(400, 'Invalid user update.');
    const { id, ...patch } = parsed.data;
    if (id === admin.id && patch.status === 'blocked') throw new HttpError(400, 'You cannot block your own account.');
    json(res, 200, await updateUser(id, patch));
  },
  async PUT(req, res) {
    await requireAdmin(req);
    const parsed = settingsSchema.safeParse(await readBody(req));
    if (!parsed.success) throw new HttpError(400, 'Invalid default limit.');
    await setDefaultMonthlyLimit(parsed.data.defaultMonthlyTokenLimit);
    json(res, 200, { defaultMonthlyTokenLimit: parsed.data.defaultMonthlyTokenLimit });
  },
});
