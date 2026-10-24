import { json, route } from '../../lib/http.js';
import { endSession } from '../../lib/auth.js';

export default route({
  async POST(_req, res) {
    endSession(res);
    json(res, 200, { ok: true });
  },
});
