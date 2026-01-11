// src/core/context.ts
import { AsyncLocalStorage } from "async_hooks";
var eventStorage = new AsyncLocalStorage();
function getCurrentEvent() {
  return eventStorage.getStore();
}
function enrichEvent(data) {
  const event = eventStorage.getStore();
  if (!event) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[@sas/logger] enrichEvent called outside request context. Data will be lost."
      );
    }
    return;
  }
  if (data.user) {
    event.user = { ...event.user, ...data.user };
  }
  if (data.business) {
    event.business = { ...event.business, ...data.business };
  }
  if (data.performance) {
    event.performance = { ...event.performance, ...data.performance };
  }
  if (data.feature_flags) {
    event.feature_flags = { ...event.feature_flags, ...data.feature_flags };
  }
}
function setEventError(error, retriable = false) {
  const event = eventStorage.getStore();
  if (!event) return;
  event.outcome = "error";
  event.error = {
    type: error.name || "Error",
    message: error.message,
    stack: error.stack,
    retriable
  };
}
function generateEventId() {
  return `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
function generateTraceId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// src/core/WideEvent.ts
var WideEventBuilder = class {
  constructor(config) {
    this.config = config;
    this.startTime = Date.now();
    this.event = this.createBaseEvent();
  }
  createBaseEvent() {
    return {
      event_id: generateEventId(),
      trace_id: generateTraceId(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      request: {
        method: "UNKNOWN",
        path: "/",
        duration_ms: 0,
        status_code: 200
      },
      service: {
        name: this.config.serviceName,
        version: this.config.serviceVersion || process.env.npm_package_version || "0.0.0",
        environment: this.config.environment || process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        region: process.env.VERCEL_REGION || process.env.AWS_REGION,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID
      },
      outcome: "success"
    };
  }
  /**
   * Set request details from a Request object (Web API).
   */
  fromRequest(request, traceId) {
    const url = new URL(request.url);
    this.event.request = {
      ...this.event.request,
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      user_agent: request.headers.get("user-agent") || void 0
    };
    this.event.trace_id = traceId || request.headers.get("x-trace-id") || request.headers.get("x-request-id") || generateTraceId();
    return this;
  }
  /**
   * Set request details from raw values (for non-standard request objects).
   */
  fromRawRequest(details) {
    this.event.request = {
      ...this.event.request,
      method: details.method,
      path: details.path,
      query: details.query,
      ip: details.ip,
      user_agent: details.userAgent
    };
    if (details.traceId) {
      this.event.trace_id = details.traceId;
    }
    return this;
  }
  /**
   * Add user context.
   */
  withUser(user) {
    this.event.user = user;
    return this;
  }
  /**
   * Add business context.
   */
  withBusiness(business) {
    this.event.business = { ...this.event.business, ...business };
    return this;
  }
  /**
   * Add performance metrics.
   */
  withPerformance(performance) {
    this.event.performance = { ...this.event.performance, ...performance };
    return this;
  }
  /**
   * Add feature flags.
   */
  withFeatureFlags(flags) {
    this.event.feature_flags = { ...this.event.feature_flags, ...flags };
    return this;
  }
  /**
   * Set error details.
   */
  withError(error, retriable = false) {
    this.event.outcome = "error";
    this.event.error = {
      type: error.name || "Error",
      message: error.message,
      stack: error.stack,
      retriable
    };
    return this;
  }
  /**
   * Set the response status code.
   */
  withStatusCode(statusCode) {
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
  enrich(data) {
    if (data.user) this.event.user = { ...this.event.user, ...data.user };
    if (data.business)
      this.event.business = { ...this.event.business, ...data.business };
    if (data.performance)
      this.event.performance = {
        ...this.event.performance,
        ...data.performance
      };
    if (data.feature_flags)
      this.event.feature_flags = {
        ...this.event.feature_flags,
        ...data.feature_flags
      };
    return this;
  }
  /**
   * Finalize the event with duration and return it.
   */
  build() {
    this.event.request.duration_ms = Date.now() - this.startTime;
    return this.event;
  }
  /**
   * Get the raw event (for enrichment during request handling).
   */
  getEvent() {
    return this.event;
  }
};

// src/core/sampling.ts
function defaultShouldSample(event, options = {}) {
  const {
    slowThresholdMs = 2e3,
    alwaysKeepSubscriptions = ["enterprise", "premium"],
    sampleRate = 0.1
  } = options;
  if (event.outcome === "error") {
    return true;
  }
  if (event.request.status_code >= 500) {
    return true;
  }
  if (event.error) {
    return true;
  }
  if (event.request.duration_ms > slowThresholdMs) {
    return true;
  }
  if (event.user?.subscription && alwaysKeepSubscriptions.includes(event.user.subscription)) {
    return true;
  }
  return Math.random() < sampleRate;
}
function keepAll() {
  return true;
}
function keepOnlyErrors(event) {
  return event.outcome === "error" || event.request.status_code >= 400 || event.error !== void 0;
}

// src/adapters/axiom.ts
var AxiomAdapter = class {
  constructor(config) {
    this.baseUrl = "https://api.axiom.co";
    this.pendingEvents = [];
    this.flushTimeout = null;
    this.dataset = config.dataset || process.env.AXIOM_DATASET || "production";
    this.token = config.token || process.env.AXIOM_TOKEN || "";
    this.debug = config.debug || false;
    if (!this.token && process.env.NODE_ENV === "production") {
      console.warn(
        "[@sas/logger] AXIOM_TOKEN not set. Events will not be sent to Axiom."
      );
    }
  }
  /**
   * Queue an event for sending. Uses batching for efficiency.
   */
  send(event) {
    if (this.debug) {
      console.log("[@sas/logger] Event:", JSON.stringify(event, null, 2));
    }
    if (!this.token) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[@sas/logger] [${event.outcome}] ${event.request.method} ${event.request.path} - ${event.request.duration_ms}ms`
        );
      }
      return;
    }
    this.pendingEvents.push(event);
    if (this.pendingEvents.length >= 10) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), 100);
    }
  }
  /**
   * Send all pending events to Axiom immediately.
   * Call this before the request ends in serverless environments.
   */
  async flush() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.pendingEvents.length === 0) {
      return;
    }
    if (!this.token) {
      this.pendingEvents = [];
      return;
    }
    const events = this.pendingEvents;
    this.pendingEvents = [];
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/datasets/${this.dataset}/ingest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(events)
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[@sas/logger] Failed to send to Axiom: ${response.status} ${errorText}`
        );
        const remaining = response.headers.get("X-IngestLimit-Remaining");
        if (remaining) {
          console.warn(
            `[@sas/logger] Axiom ingest limit remaining: ${remaining}`
          );
        }
      } else if (this.debug) {
        console.log(`[@sas/logger] Sent ${events.length} events to Axiom`);
      }
    } catch (error) {
      console.error("[@sas/logger] Error sending to Axiom:", error);
    }
  }
};
var defaultAdapter = null;
function getAxiomAdapter(config) {
  if (!defaultAdapter && config) {
    defaultAdapter = new AxiomAdapter(config);
  }
  if (!defaultAdapter) {
    throw new Error(
      "[@sas/logger] AxiomAdapter not initialized. Call initLogger first."
    );
  }
  return defaultAdapter;
}
function initAxiomAdapter(config) {
  defaultAdapter = new AxiomAdapter(config);
  return defaultAdapter;
}
export {
  AxiomAdapter,
  WideEventBuilder,
  defaultShouldSample,
  enrichEvent,
  generateEventId,
  generateTraceId,
  getAxiomAdapter,
  getCurrentEvent,
  initAxiomAdapter,
  keepAll,
  keepOnlyErrors,
  setEventError
};
//# sourceMappingURL=index.mjs.map