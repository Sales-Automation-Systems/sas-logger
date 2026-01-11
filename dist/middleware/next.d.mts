import { a as WideEvent, W as WideEventConfig, E as EnrichmentData } from '../context-DyQ6morh.mjs';
export { e as enrichEvent } from '../context-DyQ6morh.mjs';

/**
 * Generic route handler type that works with any Next.js version.
 * Uses the standard web Request type to avoid type conflicts between
 * different Next.js versions in the consuming application.
 */
type RouteHandler<TRequest extends Request = Request, TContext = {
    params?: Promise<Record<string, string>>;
}> = (request: TRequest, context?: TContext) => Promise<Response> | Response;
interface WideEventRequest extends Request {
    wideEvent: WideEvent;
}
/**
 * Initialize the logger for Next.js.
 * Call this once in your instrumentation.ts or at app startup.
 */
declare function initLogger(config: WideEventConfig): void;
/**
 * Wrap a Next.js App Router route handler with wide event logging.
 *
 * @example
 * ```ts
 * // In app/api/example/route.ts
 * import { withWideEvents, enrichEvent } from '@sas/logger/next'
 *
 * export const GET = withWideEvents(async (req) => {
 *   enrichEvent({ business: { action: 'fetch_data' } })
 *   return NextResponse.json({ data: 'example' })
 * })
 * ```
 */
declare function withWideEvents<TRequest extends Request = Request, TContext = {
    params?: Promise<Record<string, string>>;
}>(handler: RouteHandler<TRequest, TContext>): RouteHandler<TRequest, TContext>;
/**
 * Higher-order function to combine withWideEvents with other wrappers.
 *
 * @example
 * ```ts
 * const handler = compose(
 *   withWideEvents,
 *   withAuth,
 * )(async (req) => {
 *   return NextResponse.json({ ok: true })
 * })
 * ```
 */
declare function compose<TRequest extends Request = Request>(...wrappers: Array<(handler: RouteHandler<TRequest>) => RouteHandler<TRequest>>): (handler: RouteHandler<TRequest>) => RouteHandler<TRequest>;
/**
 * Create a route handler with wide events and custom enrichment.
 * Convenience function for common patterns.
 *
 * @example
 * ```ts
 * export const GET = createHandler({
 *   business: { feature: 'user_profile' }
 * }, async (req) => {
 *   return NextResponse.json({ user: { id: '123' } })
 * })
 * ```
 */
declare function createHandler<TRequest extends Request = Request>(enrichment: EnrichmentData, handler: RouteHandler<TRequest>): RouteHandler<TRequest>;
/**
 * Flush any pending events.
 * Call this before the request ends if not using withWideEvents.
 */
declare function flush(): Promise<void>;

export { type WideEventRequest, compose, createHandler, flush, initLogger, withWideEvents };
