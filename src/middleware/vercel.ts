import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WideEvent, WideEventConfig, EnrichmentData } from "../core/types";
import { WideEventBuilder } from "../core/WideEvent";
import { eventStorage, enrichEvent as enrichEventCore } from "../core/context";
import { AxiomAdapter, initAxiomAdapter } from "../adapters/axiom";
import { defaultShouldSample } from "../core/sampling";

// Re-export enrichEvent for convenience
export { enrichEvent } from "../core/context";

// Type for Vercel serverless functions
type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void;

// Extended request type with wide event
export interface WideEventVercelRequest extends VercelRequest {
  wideEvent: WideEvent;
}

let adapter: AxiomAdapter | null = null;
let globalConfig: WideEventConfig | null = null;

/**
 * Initialize the logger for Vercel serverless functions.
 * Call this once at the start of your function or in a shared module.
 */
export function initLogger(config: WideEventConfig): void {
  globalConfig = config;
  adapter = initAxiomAdapter(config);
}

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
export function withWideEvents(handler: VercelHandler): VercelHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Auto-initialize if not done yet (convenience for simple setups)
    if (!globalConfig) {
      initLogger({
        serviceName: process.env.SERVICE_NAME || "vercel-function",
      });
    }

    const builder = new WideEventBuilder(globalConfig!);

    // Extract request details from Vercel request
    builder.fromRawRequest({
      method: req.method || "UNKNOWN",
      path: req.url || "/",
      query: (req.query as Record<string, string>) || {},
      ip:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"] as string,
      traceId:
        (req.headers["x-trace-id"] as string) ||
        (req.headers["x-request-id"] as string) ||
        (req.headers["x-vercel-id"] as string),
    });

    const event = builder.getEvent();

    // Attach to request for direct access
    (req as WideEventVercelRequest).wideEvent = event;

    // Run the handler within the event context
    return eventStorage.run(event, async () => {
      try {
        await handler(req, res);

        // Capture status code after handler runs
        builder.withStatusCode(res.statusCode || 200);
      } catch (error) {
        // Capture error details
        if (error instanceof Error) {
          builder.withError(error);
        } else {
          builder.withError(new Error(String(error)));
        }

        // Set error response if not already sent
        if (!res.headersSent) {
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
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
export function createHandler(
  config: WideEventConfig,
  enrichment: EnrichmentData,
  handler: VercelHandler,
): VercelHandler {
  initLogger(config);
  return withWideEvents(async (req, res) => {
    enrichEventCore(enrichment);
    await handler(req, res);
  });
}

/**
 * Flush any pending events.
 * This is called automatically in withWideEvents, but exposed for manual use.
 */
export async function flush(): Promise<void> {
  if (adapter) {
    await adapter.flush();
  }
}
