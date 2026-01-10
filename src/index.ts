/**
 * @sas/logger - Wide Events Logging for SAS Applications
 *
 * Implements the "wide events" pattern from loggingsucks.com:
 * - One comprehensive event per request
 * - Full context (user, business, performance, errors)
 * - Structured data for powerful queries
 * - Tail sampling (always keep errors and slow requests)
 *
 * @example
 * ```ts
 * // Next.js App Router
 * import { initLogger, withWideEvents, enrichEvent } from '@sas/logger/next'
 *
 * // Initialize once (in instrumentation.ts)
 * initLogger({ serviceName: 'my-app' })
 *
 * // Wrap route handlers
 * export const GET = withWideEvents(async (req) => {
 *   enrichEvent({ business: { action: 'fetch_data' } })
 *   return NextResponse.json({ data: [] })
 * })
 * ```
 *
 * @example
 * ```ts
 * // Express (Railway worker)
 * import { initLogger, wideEventMiddleware, enrichEvent } from '@sas/logger/express'
 *
 * initLogger({ serviceName: 'webhook-worker' })
 * app.use(wideEventMiddleware())
 *
 * app.post('/webhook', (req, res) => {
 *   enrichEvent({ business: { webhookType: 'esignatures' } })
 *   res.json({ ok: true })
 * })
 * ```
 *
 * @example
 * ```ts
 * // Vercel serverless (Vite + Vercel)
 * import { withWideEvents, enrichEvent } from '@sas/logger/vercel'
 *
 * export default withWideEvents(async (req, res) => {
 *   enrichEvent({ business: { formType: 'contact' } })
 *   res.json({ success: true })
 * })
 * ```
 */

// Core types
export type {
  WideEvent,
  WideEventConfig,
  EnrichmentData,
  LogLevel,
} from "./core/types";

// Core utilities
export { WideEventBuilder } from "./core/WideEvent";
export {
  enrichEvent,
  setEventError,
  getCurrentEvent,
  generateEventId,
  generateTraceId,
} from "./core/context";

// Sampling functions
export { defaultShouldSample, keepAll, keepOnlyErrors } from "./core/sampling";

// Adapters
export {
  AxiomAdapter,
  getAxiomAdapter,
  initAxiomAdapter,
} from "./adapters/axiom";
