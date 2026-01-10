import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { WideEvent, WideEventConfig, EnrichmentData } from "../core/types";
import { WideEventBuilder } from "../core/WideEvent";
import { eventStorage, enrichEvent as enrichEventCore } from "../core/context";
import { AxiomAdapter, initAxiomAdapter } from "../adapters/axiom";
import { defaultShouldSample } from "../core/sampling";

// Re-export enrichEvent for convenience
export { enrichEvent } from "../core/context";

// Type for Next.js App Router route handlers
type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

// Extended request type with wide event
export interface WideEventRequest extends NextRequest {
  wideEvent: WideEvent;
}

let adapter: AxiomAdapter | null = null;
let globalConfig: WideEventConfig | null = null;

/**
 * Initialize the logger for Next.js.
 * Call this once in your instrumentation.ts or at app startup.
 */
export function initLogger(config: WideEventConfig): void {
  globalConfig = config;
  adapter = initAxiomAdapter(config);
}

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
export function withWideEvents(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context) => {
    if (!globalConfig) {
      console.warn(
        "[@sas/logger] Logger not initialized. Call initLogger() first.",
      );
      return handler(request, context);
    }

    const builder = new WideEventBuilder(globalConfig);
    builder.fromRequest(request);

    const event = builder.getEvent();

    // Run the handler within the event context
    return eventStorage.run(event, async () => {
      try {
        const response = await handler(request, context);

        // Capture status code from response
        builder.withStatusCode(response.status);

        return response;
      } catch (error) {
        // Capture error details
        if (error instanceof Error) {
          builder.withError(error);
        } else {
          builder.withError(new Error(String(error)));
        }

        // Re-throw to let Next.js handle it
        throw error;
      } finally {
        // Finalize and send the event
        const finalEvent = builder.build();

        // Apply sampling
        const shouldKeep = globalConfig?.shouldSample
          ? globalConfig.shouldSample(finalEvent)
          : defaultShouldSample(finalEvent);

        if (shouldKeep && adapter) {
          adapter.send(finalEvent);
          await adapter.flush(); // Critical for serverless!
        }
      }
    });
  };
}

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
export function compose(
  ...wrappers: Array<(handler: RouteHandler) => RouteHandler>
): (handler: RouteHandler) => RouteHandler {
  return (handler) => wrappers.reduceRight((h, wrapper) => wrapper(h), handler);
}

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
export function createHandler(
  enrichment: EnrichmentData,
  handler: RouteHandler,
): RouteHandler {
  return withWideEvents(async (request, context) => {
    enrichEventCore(enrichment);
    return handler(request, context);
  });
}

/**
 * Flush any pending events.
 * Call this before the request ends if not using withWideEvents.
 */
export async function flush(): Promise<void> {
  if (adapter) {
    await adapter.flush();
  }
}
