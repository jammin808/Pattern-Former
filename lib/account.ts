import { isAdmin } from './auth.js';
import { defaultMonthlyLimit, monthUsage, type AppUser } from './db.js';
import type { Account, Allowance } from './types.js';

// Admins are not limited; everyone else gets their own limit or the default.
export async function allowanceFor(user: AppUser): Promise<Allowance> {
  const [monthTokens, limit] = await Promise.all([
    monthUsage(user.id),
    isAdmin(user.email) ? Promise.resolve(null) : user.monthly_token_limit ?? defaultMonthlyLimit(),
  ]);
  return { monthTokens, limit };
}

export async function describeAccount(user: AppUser): Promise<Account> {
  return {
    user: { id: user.id, email: user.email, name: user.name, picture: user.picture, status: user.status, isAdmin: isAdmin(user.email) },
    allowance: await allowanceFor(user),
  };
}
