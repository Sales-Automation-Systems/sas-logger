import type { WideEvent, WideEventConfig, EnrichmentData } from "./types";
import { generateEventId, generateTraceId } from "./context";

/**
 * Builder class for creating wide events.
 * Provides a fluent API for constructing events with all context.
 *
 * @example
 * ```ts
 * const event = new WideEventBuilder(config)
 *   .fromRequest(request)
 *   .withUser({ id: user.id, email: user.email })
 *   .withBusiness({ dealId: "deal_123" })
 *   .build()
 * ```
 */
export class WideEventBuilder {
  private event: WideEvent;
  private config: WideEventConfig;
  private startTime: number;

  constructor(config: WideEventConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.event = this.createBaseEvent();
  }

  private createBaseEvent(): WideEvent {
    return {
      event_id: generateEventId(),
      trace_id: generateTraceId(),
      timestamp: new Date().toISOString(),
      request: {
        method: "UNKNOWN",
        path: "/",
        duration_ms: 0,
        status_code: 200,
      },
      service: {
        name: this.config.serviceName,
        version:
          this.config.serviceVersion ||
          process.env.npm_package_version ||
          "0.0.0",
        environment:
          this.config.environment ||
          process.env.VERCEL_ENV ||
          process.env.NODE_ENV ||
          "development",
        region: process.env.VERCEL_REGION || process.env.AWS_REGION,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
      },
      outcome: "success",
    };
  }

  /**
   * Set request details from a Request object (Web API).
   */
  fromRequest(request: Request, traceId?: string): this {
    const url = new URL(request.url);

    this.event.request = {
      ...this.event.request,
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      user_agent: request.headers.get("user-agent") || undefined,
    };

    // Use provided trace ID or check header or generate new
    this.event.trace_id =
      traceId ||
      request.headers.get("x-trace-id") ||
      request.headers.get("x-request-id") ||
      generateTraceId();

    return this;
  }

  /**
   * Set request details from raw values (for non-standard request objects).
   */
  fromRawRequest(details: {
    method: string;
    path: string;
    query?: Record<string, string>;
    ip?: string;
    userAgent?: string;
    traceId?: string;
  }): this {
    this.event.request = {
      ...this.event.request,
      method: details.method,
      path: details.path,
      query: details.query,
      ip: details.ip,
      user_agent: details.userAgent,
    };

    if (details.traceId) {
      this.event.trace_id = details.traceId;
    }

    return this;
  }

  /**
   * Add user context.
   */
  withUser(user: WideEvent["user"]): this {
    this.event.user = user;
    return this;
  }

  /**
   * Add business context.
   */
  withBusiness(business: WideEvent["business"]): this {
    this.event.business = { ...this.event.business, ...business };
    return this;
  }

  /**
   * Add performance metrics.
   */
  withPerformance(performance: WideEvent["performance"]): this {
    this.event.performance = { ...this.event.performance, ...performance };
    return this;
  }

  /**
   * Add feature flags.
   */
  withFeatureFlags(flags: Record<string, boolean>): this {
    this.event.feature_flags = { ...this.event.feature_flags, ...flags };
    return this;
  }

  /**
   * Set error details.
   */
  withError(error: Error, retriable = false): this {
    this.event.outcome = "error";
    this.event.error = {
      type: error.name || "Error",
      message: error.message,
      stack: error.stack,
      retriable,
    };
    return this;
  }

  /**
   * Set the response status code.
   */
  withStatusCode(statusCode: number): this {
    this.event.request.status_code = statusCode;
    if (statusCode >= 500) {
      this.event.outcome = "error";
    } else if (statusCode >= 400) {
      this.event.outcome = "warning";
    }
    return this;
  }

  /**
   * Enrich with arbitrary data (merges into existing).
   */
  enrich(data: EnrichmentData): this {
    if (data.user) this.event.user = { ...this.event.user, ...data.user };
    if (data.business)
      this.event.business = { ...this.event.business, ...data.business };
    if (data.performance)
      this.event.performance = {
        ...this.event.performance,
        ...data.performance,
      };
    if (data.feature_flags)
      this.event.feature_flags = {
        ...this.event.feature_flags,
        ...data.feature_flags,
      };
    return this;
  }

  /**
   * Finalize the event with duration and return it.
   */
  build(): WideEvent {
    this.event.request.duration_ms = Date.now() - this.startTime;
    return this.event;
  }

  /**
   * Get the raw event (for enrichment during request handling).
   */
  getEvent(): WideEvent {
    return this.event;
  }
}
