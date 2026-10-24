import { json, route } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { describeAccount } from '../lib/account.js';

export default route({
  async GET(req, res) {
    json(res, 200, await describeAccount(await requireUser(req)));
  },
});
