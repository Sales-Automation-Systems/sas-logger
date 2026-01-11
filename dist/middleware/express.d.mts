import { Request, RequestHandler, Response, NextFunction } from 'express';
import { a as WideEvent, W as WideEventConfig, E as EnrichmentData } from '../context-DyQ6morh.mjs';
export { e as enrichEvent } from '../context-DyQ6morh.mjs';

interface WideEventRequest extends Request {
    wideEvent: WideEvent;
}
/**
 * Initialize the logger for Express.
 * Call this once at app startup.
 */
declare function initLogger(config: WideEventConfig): void;
/**
 * Express middleware that adds wide event logging to all requests.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { initLogger, wideEventMiddleware } from '@sas/logger/express'
 *
 * const app = express()
 *
 * initLogger({ serviceName: 'webhook-worker' })
 * app.use(wideEventMiddleware())
 *
 * app.post('/webhook', (req, res) => {
 *   enrichEvent({ business: { webhookType: 'esignatures' } })
 *   res.json({ ok: true })
 * })
 * ```
 */
declare function wideEventMiddleware(): RequestHandler;
/**
 * Error handling middleware that captures errors in wide events.
 * Add this AFTER your routes but BEFORE your error handler.
 */
declare function wideEventErrorMiddleware(): (err: Error, req: Request, res: Response, next: NextFunction) => void;
/**
 * Wrap a specific route handler with wide event enrichment.
 * Use this for route-specific context.
 *
 * @example
 * ```ts
 * app.post('/webhook/esignatures',
 *   withEnrichment({ business: { webhookType: 'esignatures' } }),
 *   async (req, res) => {
 *     // handler code
 *   }
 * )
 * ```
 */
declare function withEnrichment(enrichment: EnrichmentData): RequestHandler;
/**
 * Flush any pending events.
 * Call this before shutting down the server.
 */
declare function flush(): Promise<void>;

export { type WideEventRequest, flush, initLogger, wideEventErrorMiddleware, wideEventMiddleware, withEnrichment };
