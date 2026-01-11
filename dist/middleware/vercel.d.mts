import { VercelRequest, VercelResponse } from '@vercel/node';
import { a as WideEvent, W as WideEventConfig, E as EnrichmentData } from '../context-DyQ6morh.mjs';
export { e as enrichEvent } from '../context-DyQ6morh.mjs';

type VercelHandler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;
interface WideEventVercelRequest extends VercelRequest {
    wideEvent: WideEvent;
}
/**
 * Initialize the logger for Vercel serverless functions.
 * Call this once at the start of your function or in a shared module.
 */
declare function initLogger(config: WideEventConfig): void;
/**
 * Wrap a Vercel serverless function with wide event logging.
 * Use this for Vite + Vercel setups (not Next.js).
 *
 * @example
 * ```ts
 * // In api/submit-form.ts
 * import { initLogger, withWideEvents, enrichEvent } from '@sas/logger/vercel'
 *
 * initLogger({ serviceName: 'sas-website' })
 *
 * export default withWideEvents(async (req, res) => {
 *   enrichEvent({ business: { formType: 'contact' } })
 *
 *   // Process form...
 *
 *   res.status(200).json({ success: true })
 * })
 * ```
 */
declare function withWideEvents(handler: VercelHandler): VercelHandler;
/**
 * Create a Vercel handler with initialization and enrichment in one call.
 * Convenience function for simple setups.
 *
 * @example
 * ```ts
 * export default createHandler(
 *   { serviceName: 'sas-website' },
 *   { business: { formType: 'contact' } },
 *   async (req, res) => {
 *     res.json({ ok: true })
 *   }
 * )
 * ```
 */
declare function createHandler(config: WideEventConfig, enrichment: EnrichmentData, handler: VercelHandler): VercelHandler;
/**
 * Flush any pending events.
 * This is called automatically in withWideEvents, but exposed for manual use.
 */
declare function flush(): Promise<void>;

export { type WideEventVercelRequest, createHandler, flush, initLogger, withWideEvents };
