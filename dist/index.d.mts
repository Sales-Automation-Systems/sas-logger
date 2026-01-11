import { W as WideEventConfig, a as WideEvent, E as EnrichmentData } from './context-DyQ6morh.mjs';
export { L as LogLevel, e as enrichEvent, b as generateEventId, c as generateTraceId, g as getCurrentEvent, s as setEventError } from './context-DyQ6morh.mjs';

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
declare class WideEventBuilder {
    private event;
    private config;
    private startTime;
    constructor(config: WideEventConfig);
    private createBaseEvent;
    /**
     * Set request details from a Request object (Web API).
     */
    fromRequest(request: Request, traceId?: string): this;
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
    }): this;
    /**
     * Add user context.
     */
    withUser(user: WideEvent["user"]): this;
    /**
     * Add business context.
     */
    withBusiness(business: WideEvent["business"]): this;
    /**
     * Add performance metrics.
     */
    withPerformance(performance: WideEvent["performance"]): this;
    /**
     * Add feature flags.
     */
    withFeatureFlags(flags: Record<string, boolean>): this;
    /**
     * Set error details.
     */
    withError(error: Error, retriable?: boolean): this;
    /**
     * Set the response status code.
     */
    withStatusCode(statusCode: number): this;
    /**
     * Enrich with arbitrary data (merges into existing).
     */
    enrich(data: EnrichmentData): this;
    /**
     * Finalize the event with duration and return it.
     */
    build(): WideEvent;
    /**
     * Get the raw event (for enrichment during request handling).
     */
    getEvent(): WideEvent;
}

/**
 * Default tail sampling function.
 * Implements the "always keep errors, always keep slow" pattern from loggingsucks.com.
 *
 * Rules:
 * 1. Always keep errors (100%)
 * 2. Always keep slow requests (above threshold)
 * 3. Always keep specific user tiers
 * 4. Random sample the rest
 */
declare function defaultShouldSample(event: WideEvent, options?: {
    /** Latency threshold in ms (default: 2000) */
    slowThresholdMs?: number;
    /** User subscriptions to always keep (default: ["enterprise"]) */
    alwaysKeepSubscriptions?: string[];
    /** Random sample rate for normal events (default: 0.1 = 10%) */
    sampleRate?: number;
}): boolean;
/**
 * No sampling - keep everything.
 * Use this when you want complete observability and cost is not a concern.
 */
declare function keepAll(): boolean;
/**
 * Only keep errors - minimal sampling.
 * Use this for high-traffic routes where you only care about failures.
 */
declare function keepOnlyErrors(event: WideEvent): boolean;

/**
 * Axiom transport adapter.
 * Handles sending wide events to Axiom's ingest API.
 */
declare class AxiomAdapter {
    private dataset;
    private token;
    private debug;
    private baseUrl;
    private pendingEvents;
    private flushTimeout;
    constructor(config: WideEventConfig);
    /**
     * Queue an event for sending. Uses batching for efficiency.
     */
    send(event: WideEvent): void;
    /**
     * Send all pending events to Axiom immediately.
     * Call this before the request ends in serverless environments.
     */
    flush(): Promise<void>;
}
/**
 * Get or create the default Axiom adapter.
 */
declare function getAxiomAdapter(config?: WideEventConfig): AxiomAdapter;
/**
 * Initialize the default Axiom adapter.
 */
declare function initAxiomAdapter(config: WideEventConfig): AxiomAdapter;

export { AxiomAdapter, EnrichmentData, WideEvent, WideEventBuilder, WideEventConfig, defaultShouldSample, getAxiomAdapter, initAxiomAdapter, keepAll, keepOnlyErrors };
