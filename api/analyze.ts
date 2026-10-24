import { analysisRequestSchema } from '../lib/schema.js';
import { configuredModel, configuredProvider, runAnalysis, type TokenUsage } from '../lib/reasoning.js';
import { HttpError, json, readBody, route } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { allowanceFor } from '../lib/account.js';
import { recordUsage } from '../lib/db.js';
import type { AnalysisResult } from '../lib/types.js';

export default route({
  async POST(req, res) {
    const provider = configuredProvider();
    if (!provider) throw new HttpError(503, 'Server is not configured with ANTHROPIC_API_KEY (or GEMINI_API_KEY).');
    const user = await requireUser(req);
    if (user.status === 'blocked') throw new HttpError(403, 'Your account has been blocked. Contact the administrator.');
    // Checked before the run starts, so one run can take a user slightly past their limit.
    const allowance = await allowanceFor(user);
    if (allowance.limit !== null && allowance.monthTokens >= allowance.limit) {
      throw new HttpError(429, `You have used your ${allowance.limit.toLocaleString('en')} token allowance for this month.`);
    }
    const parsed = analysisRequestSchema.safeParse(await readBody(req));
    if (!parsed.success) {
      json(res, 400, { error: 'Invalid request.', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    const usage: TokenUsage = { input: 0, output: 0 };
    let result: AnalysisResult | undefined;
    try {
      result = await runAnalysis(parsed.data, usage);
    } catch (error) {
      console.error('Analysis failed:', error instanceof Error ? error.name + ': ' + error.message : 'Unknown error');
    }
    // Recorded before responding (Vercel may pause the function once the response is sent),
    // and for failed runs too, because tokens spent on failed stages still cost money.
    if (usage.input + usage.output > 0) {
      await recordUsage({
        userId: user.id, mode: parsed.data.mode, provider, model: configuredModel(),
        inputTokens: usage.input, outputTokens: usage.output, succeeded: Boolean(result),
      }).catch(error => console.error('Usage recording failed:', error instanceof Error ? error.message : error));
    }
    if (!result) throw new HttpError(502, 'Analysis failed. Check server logs and model configuration.');
    json(res, 200, result);
  },
});
