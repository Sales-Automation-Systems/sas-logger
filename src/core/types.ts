/**
 * Wide Event Schema
 * Based on the "wide events" / "canonical log lines" pattern from loggingsucks.com
 * One comprehensive event per request with all context attached.
 */

export interface WideEvent {
  // Identity - unique identifiers for this event
  event_id: string;
  trace_id: string;
  timestamp: string;

  // Request context
  request: {
    method: string;
    path: string;
    query?: Record<string, string>;
    duration_ms: number;
    status_code: number;
    ip?: string;
    user_agent?: string;
  };

  // Service metadata
  service: {
    name: string;
    version: string;
    environment: string;
    region?: string;
    deployment_id?: string;
  };

  // User context (when authenticated)
  user?: {
    id: string;
    email?: string;
    role?: string;
    subscription?: string;
    account_age_days?: number;
  };

  // Business context (varies by route/action)
  business?: Record<string, unknown>;

  // Performance metrics
  performance?: {
    db_queries?: number;
    db_duration_ms?: number;
    external_calls?: number;
    cache_hits?: number;
    cache_misses?: number;
  };

  // Error details (if any)
  error?: {
    type: string;
    message: string;
    code?: string;
    stack?: string;
    retriable: boolean;
  };

  // Feature flags active during request
  feature_flags?: Record<string, boolean>;

  // Overall outcome
  outcome: "success" | "error" | "warning";
}

export interface WideEventConfig {
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

export interface EnrichmentData {
  user?: WideEvent["user"];
  business?: WideEvent["business"];
  performance?: WideEvent["performance"];
  feature_flags?: WideEvent["feature_flags"];
}

export type LogLevel = "debug" | "info" | "warn" | "error";
