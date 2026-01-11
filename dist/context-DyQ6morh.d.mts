/**
 * Wide Event Schema
 * Based on the "wide events" / "canonical log lines" pattern from loggingsucks.com
 * One comprehensive event per request with all context attached.
 */
interface WideEvent {
    event_id: string;
    trace_id: string;
    timestamp: string;
    request: {
        method: string;
        path: string;
        query?: Record<string, string>;
        duration_ms: number;
        status_code: number;
        ip?: string;
        user_agent?: string;
    };
    service: {
        name: string;
        version: string;
        environment: string;
        region?: string;
        deployment_id?: string;
    };
    user?: {
        id: string;
        email?: string;
        role?: string;
        subscription?: string;
        account_age_days?: number;
    };
    business?: Record<string, unknown>;
    performance?: {
        db_queries?: number;
        db_duration_ms?: number;
        external_calls?: number;
        cache_hits?: number;
        cache_misses?: number;
    };
    error?: {
        type: string;
        message: string;
        code?: string;
        stack?: string;
        retriable: boolean;
    };
    feature_flags?: Record<string, boolean>;
    outcome: "success" | "error" | "warning";
}
interface WideEventConfig {
    /** Service name (e.g., "internal-tools", "attribution") */
    serviceName: string;
    /** Service version (from package.json or env) */
    serviceVersion?: string;
    /** Environment (production, preview, development) */
    environment?: string;
    /** Axiom dataset name */
    dataset?: string;
    /** Axiom API token */
    token?: string;
    /** Enable debug logging to console */
    debug?: boolean;
    /** Custom sampling function - return true to keep event */
    shouldSample?: (event: WideEvent) => boolean;
}
interface EnrichmentData {
    user?: WideEvent["user"];
    business?: WideEvent["business"];
    performance?: WideEvent["performance"];
    feature_flags?: WideEvent["feature_flags"];
}
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Get the current wide event from context.
 * Returns undefined if called outside a request context.
 */
declare function getCurrentEvent(): WideEvent | undefined;
/**
 * Enrich the current wide event with additional data.
 * This is the primary way handlers add business context.
 *
 * @example
 * ```ts
 * enrichEvent({
 *   user: { id: user.id, email: user.email },
 *   business: { dealId: "deal_123", action: "quote_sent" }
 * })
 * ```
 */
declare function enrichEvent(data: EnrichmentData): void;
/**
 * Set the error on the current wide event.
 * Automatically sets outcome to "error".
 */
declare function setEventError(error: Error, retriable?: boolean): void;
/**
 * Generate a unique event ID.
 */
declare function generateEventId(): string;
/**
 * Generate a trace ID (can be passed from upstream or generated fresh).
 */
declare function generateTraceId(): string;

export { type EnrichmentData as E, type LogLevel as L, type WideEventConfig as W, type WideEvent as a, generateEventId as b, generateTraceId as c, enrichEvent as e, getCurrentEvent as g, setEventError as s };
