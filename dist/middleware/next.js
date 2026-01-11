"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/middleware/next.ts
var next_exports = {};
__export(next_exports, {
  compose: () => compose,
  createHandler: () => createHandler,
  enrichEvent: () => enrichEvent,
  flush: () => flush,
  initLogger: () => initLogger,
  withWideEvents: () => withWideEvents
});
module.exports = __toCommonJS(next_exports);

// src/core/context.ts
var import_async_hooks = require("async_hooks");
var eventStorage = new import_async_hooks.AsyncLocalStorage();
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
function initAxiomAdapter(config) {
  defaultAdapter = new AxiomAdapter(config);
  return defaultAdapter;
}

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

// src/middleware/next.ts
var adapter = null;
var globalConfig = null;
function initLogger(config) {
  globalConfig = config;
  adapter = initAxiomAdapter(config);
}
function withWideEvents(handler) {
  return async (request, context) => {
    if (!globalConfig) {
      console.warn(
        "[@sas/logger] Logger not initialized. Call initLogger() first."
      );
      return handler(request, context);
    }
    const builder = new WideEventBuilder(globalConfig);
    builder.fromRequest(request);
    const event = builder.getEvent();
    return eventStorage.run(event, async () => {
      try {
        const response = await handler(request, context);
        builder.withStatusCode(response.status);
        return response;
      } catch (error) {
        if (error instanceof Error) {
          builder.withError(error);
        } else {
          builder.withError(new Error(String(error)));
        }
        throw error;
      } finally {
        const finalEvent = builder.build();
        const shouldKeep = globalConfig?.shouldSample ? globalConfig.shouldSample(finalEvent) : defaultShouldSample(finalEvent);
        if (shouldKeep && adapter) {
          adapter.send(finalEvent);
          await adapter.flush();
        }
      }
    });
  };
}
function compose(...wrappers) {
  return (handler) => wrappers.reduceRight((h, wrapper) => wrapper(h), handler);
}
function createHandler(enrichment, handler) {
  return withWideEvents(async (request, context) => {
    enrichEvent(enrichment);
    return handler(request, context);
  });
}
async function flush() {
  if (adapter) {
    await adapter.flush();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  compose,
  createHandler,
  enrichEvent,
  flush,
  initLogger,
  withWideEvents
});
//# sourceMappingURL=next.js.map