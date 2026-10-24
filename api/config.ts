import { json, route } from '../lib/http.js';

// Public settings the browser needs before sign-in. The Google client ID is not a secret.
export default route({
  async GET(_req, res) {
    json(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID || null });
  },
});
