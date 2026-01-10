import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { WideEvent, WideEventConfig, EnrichmentData } from "../core/types";
import { WideEventBuilder } from "../core/WideEvent";
import { eventStorage, enrichEvent as enrichEventCore } from "../core/context";
import { AxiomAdapter, initAxiomAdapter } from "../adapters/axiom";
import { defaultShouldSample } from "../core/sampling";

// Re-export enrichEvent for convenience
export { enrichEvent } from "../core/context";

// Extended request type with wide event
export interface WideEventRequest extends Request {
  wideEvent: WideEvent;
}

let adapter: AxiomAdapter | null = null;
let globalConfig: WideEventConfig | null = null;

/**
 * Initialize the logger for Express.
 * Call this once at app startup.
 */
export function initLogger(config: WideEventConfig): void {
  globalConfig = config;
  adapter = initAxiomAdapter(config);
}

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
export function wideEventMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!globalConfig) {
      console.warn(
        "[@sas/logger] Logger not initialized. Call initLogger() first.",
      );
      return next();
    }

    const builder = new WideEventBuilder(globalConfig);

    // Extract request details
    builder.fromRawRequest({
      method: req.method,
      path: req.path || req.url,
      query: req.query as Record<string, string>,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get("user-agent"),
      traceId: req.get("x-trace-id") || req.get("x-request-id"),
    });

    const event = builder.getEvent();

    // Attach to request for direct access
    (req as WideEventRequest).wideEvent = event;

    // Capture response status
    const originalEnd = res.end;
    res.end = function (
      this: Response,
      ...args: Parameters<typeof originalEnd>
    ) {
      builder.withStatusCode(res.statusCode);

      // Finalize and send the event
      const finalEvent = builder.build();

      // Apply sampling
      const shouldKeep = globalConfig?.shouldSample
        ? globalConfig.shouldSample(finalEvent)
        : defaultShouldSample(finalEvent);

      if (shouldKeep && adapter) {
        adapter.send(finalEvent);
        // Flush asynchronously - don't block response
        adapter.flush().catch((err) => {
          console.error("[@sas/logger] Flush error:", err);
        });
      }

      return originalEnd.apply(this, args);
    } as typeof originalEnd;

    // Run handler within event context
    eventStorage.run(event, () => {
      next();
    });
  };
}

/**
 * Error handling middleware that captures errors in wide events.
 * Add this AFTER your routes but BEFORE your error handler.
 */
export function wideEventErrorMiddleware(): (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    const event = (req as WideEventRequest).wideEvent;
    if (event) {
      event.outcome = "error";
      event.error = {
        type: err.name || "Error",
        message: err.message,
        stack: err.stack,
        retriable: false,
      };
    }
    next(err);
  };
}

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
export function withEnrichment(enrichment: EnrichmentData): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    enrichEventCore(enrichment);
    next();
  };
}

/**
 * Flush any pending events.
 * Call this before shutting down the server.
 */
export async function flush(): Promise<void> {
  if (adapter) {
    await adapter.flush();
  }
}
