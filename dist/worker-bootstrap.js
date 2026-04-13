var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../node_modules/.pnpm/@paperclipai+plugin-sdk@2026.325.0_react@19.2.4/node_modules/@paperclipai/plugin-sdk/dist/define-plugin.js
function definePlugin(definition) {
  return Object.freeze({ definition });
}

// ../../node_modules/.pnpm/@paperclipai+plugin-sdk@2026.325.0_react@19.2.4/node_modules/@paperclipai/plugin-sdk/dist/worker-rpc-host.js
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// ../../node_modules/.pnpm/@paperclipai+plugin-sdk@2026.325.0_react@19.2.4/node_modules/@paperclipai/plugin-sdk/dist/protocol.js
var JSONRPC_VERSION = "2.0";
var JSONRPC_ERROR_CODES = {
  /** Invalid JSON was received by the server. */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object. */
  INVALID_REQUEST: -32600,
  /** The method does not exist or is not available. */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameter(s). */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error. */
  INTERNAL_ERROR: -32603
};
var PLUGIN_RPC_ERROR_CODES = {
  /** The worker process is not running or not reachable. */
  WORKER_UNAVAILABLE: -32e3,
  /** The plugin does not have the required capability for this operation. */
  CAPABILITY_DENIED: -32001,
  /** The worker reported an unhandled error during method execution. */
  WORKER_ERROR: -32002,
  /** The method call timed out waiting for the worker response. */
  TIMEOUT: -32003,
  /** The worker does not implement the requested optional method. */
  METHOD_NOT_IMPLEMENTED: -32004,
  /** A catch-all for errors that do not fit other categories. */
  UNKNOWN: -32099
};
var _nextId = 1;
var MAX_SAFE_RPC_ID = Number.MAX_SAFE_INTEGER - 1;
function createRequest(method, params, id) {
  if (_nextId >= MAX_SAFE_RPC_ID) {
    _nextId = 1;
  }
  return {
    jsonrpc: JSONRPC_VERSION,
    id: id ?? _nextId++,
    method,
    params
  };
}
function createSuccessResponse(id, result) {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    result
  };
}
function createErrorResponse(id, code, message, data) {
  const response = {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: data !== void 0 ? { code, message, data } : { code, message }
  };
  return response;
}
function createNotification(method, params) {
  return {
    jsonrpc: JSONRPC_VERSION,
    method,
    params
  };
}
function isJsonRpcRequest(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const obj = value;
  return obj.jsonrpc === JSONRPC_VERSION && typeof obj.method === "string" && "id" in obj && obj.id !== void 0 && obj.id !== null;
}
function isJsonRpcNotification(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const obj = value;
  return obj.jsonrpc === JSONRPC_VERSION && typeof obj.method === "string" && !("id" in obj);
}
function isJsonRpcResponse(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const obj = value;
  return obj.jsonrpc === JSONRPC_VERSION && "id" in obj && ("result" in obj || "error" in obj);
}
function isJsonRpcSuccessResponse(response) {
  return "result" in response && !("error" in response && response.error !== void 0);
}
function isJsonRpcErrorResponse(response) {
  return "error" in response && response.error !== void 0;
}
var MESSAGE_DELIMITER = "\n";
function serializeMessage(message) {
  return JSON.stringify(message) + MESSAGE_DELIMITER;
}
function parseMessage(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    throw new JsonRpcParseError("Empty message");
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new JsonRpcParseError(`Invalid JSON: ${trimmed.slice(0, 200)}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new JsonRpcParseError("Message must be a JSON object");
  }
  const obj = parsed;
  if (obj.jsonrpc !== JSONRPC_VERSION) {
    throw new JsonRpcParseError(`Invalid or missing jsonrpc version (expected "${JSONRPC_VERSION}", got ${JSON.stringify(obj.jsonrpc)})`);
  }
  return parsed;
}
var JsonRpcParseError = class extends Error {
  name = "JsonRpcParseError";
  constructor(message) {
    super(message);
  }
};
var JsonRpcCallError = class extends Error {
  name = "JsonRpcCallError";
  /** The JSON-RPC error code. */
  code;
  /** Optional structured error data from the response. */
  data;
  constructor(error) {
    super(error.message);
    this.code = error.code;
    this.data = error.data;
  }
};

// ../../node_modules/.pnpm/@paperclipai+plugin-sdk@2026.325.0_react@19.2.4/node_modules/@paperclipai/plugin-sdk/dist/worker-rpc-host.js
var DEFAULT_RPC_TIMEOUT_MS = 3e4;
function runWorker(plugin2, moduleUrl, options) {
  if (options?.stdin != null && options?.stdout != null) {
    return startWorkerRpcHost({
      plugin: plugin2,
      stdin: options.stdin,
      stdout: options.stdout
    });
  }
  const entry = process.argv[1];
  if (typeof entry !== "string")
    return;
  const thisFile = path.resolve(fileURLToPath(moduleUrl));
  const entryPath = path.resolve(entry);
  if (thisFile === entryPath) {
    startWorkerRpcHost({ plugin: plugin2 });
  }
}
function startWorkerRpcHost(options) {
  const { plugin: plugin2 } = options;
  const stdinStream = options.stdin ?? process.stdin;
  const stdoutStream = options.stdout ?? process.stdout;
  const rpcTimeoutMs = options.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  let running = true;
  let initialized = false;
  let manifest2 = null;
  let currentConfig = {};
  const eventHandlers = [];
  const jobHandlers = /* @__PURE__ */ new Map();
  const launcherRegistrations = /* @__PURE__ */ new Map();
  const dataHandlers = /* @__PURE__ */ new Map();
  const actionHandlers = /* @__PURE__ */ new Map();
  const toolHandlers = /* @__PURE__ */ new Map();
  const sessionEventCallbacks = /* @__PURE__ */ new Map();
  const pendingRequests = /* @__PURE__ */ new Map();
  let nextOutboundId = 1;
  const MAX_OUTBOUND_ID = Number.MAX_SAFE_INTEGER - 1;
  function sendMessage(message) {
    if (!running)
      return;
    const serialized = serializeMessage(message);
    stdoutStream.write(serialized);
  }
  function callHost(method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!running) {
        reject(new Error(`Cannot call "${method}" \u2014 worker RPC host is not running`));
        return;
      }
      if (nextOutboundId >= MAX_OUTBOUND_ID) {
        nextOutboundId = 1;
      }
      const id = nextOutboundId++;
      const timeout = timeoutMs ?? rpcTimeoutMs;
      let settled = false;
      const settle = (fn, value) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        pendingRequests.delete(id);
        fn(value);
      };
      const timer = setTimeout(() => {
        settle(reject, new JsonRpcCallError({
          code: PLUGIN_RPC_ERROR_CODES.TIMEOUT,
          message: `Worker\u2192host call "${method}" timed out after ${timeout}ms`
        }));
      }, timeout);
      pendingRequests.set(id, {
        resolve: (response) => {
          if (isJsonRpcSuccessResponse(response)) {
            settle(resolve, response.result);
          } else if (isJsonRpcErrorResponse(response)) {
            settle(reject, new JsonRpcCallError(response.error));
          } else {
            settle(reject, new Error(`Unexpected response format for "${method}"`));
          }
        },
        timer
      });
      try {
        const request = createRequest(method, params, id);
        sendMessage(request);
      } catch (err) {
        settle(reject, err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  function notifyHost(method, params) {
    try {
      sendMessage(createNotification(method, params));
    } catch {
    }
  }
  function buildContext() {
    return {
      get manifest() {
        if (!manifest2)
          throw new Error("Plugin context accessed before initialization");
        return manifest2;
      },
      config: {
        async get() {
          return callHost("config.get", {});
        }
      },
      events: {
        on(name, filterOrFn, maybeFn) {
          let registration;
          if (typeof filterOrFn === "function") {
            registration = { name, fn: filterOrFn };
          } else {
            if (!maybeFn)
              throw new Error("Event handler function is required");
            registration = { name, filter: filterOrFn, fn: maybeFn };
          }
          eventHandlers.push(registration);
          void callHost("events.subscribe", { eventPattern: name, filter: registration.filter ?? null }).catch((err) => {
            notifyHost("log", {
              level: "warn",
              message: `Failed to subscribe to event "${name}" on host: ${err instanceof Error ? err.message : String(err)}`
            });
          });
          return () => {
            const idx = eventHandlers.indexOf(registration);
            if (idx !== -1)
              eventHandlers.splice(idx, 1);
          };
        },
        async emit(name, companyId, payload) {
          await callHost("events.emit", { name, companyId, payload });
        }
      },
      jobs: {
        register(key, fn) {
          jobHandlers.set(key, fn);
        }
      },
      launchers: {
        register(launcher) {
          launcherRegistrations.set(launcher.id, launcher);
        }
      },
      http: {
        async fetch(url, init) {
          const serializedInit = {};
          if (init) {
            if (init.method)
              serializedInit.method = init.method;
            if (init.headers) {
              if (init.headers instanceof Headers) {
                const obj = {};
                init.headers.forEach((v, k) => {
                  obj[k] = v;
                });
                serializedInit.headers = obj;
              } else if (Array.isArray(init.headers)) {
                const obj = {};
                for (const [k, v] of init.headers)
                  obj[k] = v;
                serializedInit.headers = obj;
              } else {
                serializedInit.headers = init.headers;
              }
            }
            if (init.body !== void 0 && init.body !== null) {
              serializedInit.body = typeof init.body === "string" ? init.body : String(init.body);
            }
          }
          const result = await callHost("http.fetch", {
            url,
            init: Object.keys(serializedInit).length > 0 ? serializedInit : void 0
          });
          return new Response(result.body, {
            status: result.status,
            statusText: result.statusText,
            headers: result.headers
          });
        }
      },
      secrets: {
        async resolve(secretRef) {
          return callHost("secrets.resolve", { secretRef });
        }
      },
      activity: {
        async log(entry) {
          await callHost("activity.log", {
            companyId: entry.companyId,
            message: entry.message,
            entityType: entry.entityType,
            entityId: entry.entityId,
            metadata: entry.metadata
          });
        }
      },
      state: {
        async get(input) {
          return callHost("state.get", {
            scopeKind: input.scopeKind,
            scopeId: input.scopeId,
            namespace: input.namespace,
            stateKey: input.stateKey
          });
        },
        async set(input, value) {
          await callHost("state.set", {
            scopeKind: input.scopeKind,
            scopeId: input.scopeId,
            namespace: input.namespace,
            stateKey: input.stateKey,
            value
          });
        },
        async delete(input) {
          await callHost("state.delete", {
            scopeKind: input.scopeKind,
            scopeId: input.scopeId,
            namespace: input.namespace,
            stateKey: input.stateKey
          });
        }
      },
      entities: {
        async upsert(input) {
          return callHost("entities.upsert", {
            entityType: input.entityType,
            scopeKind: input.scopeKind,
            scopeId: input.scopeId,
            externalId: input.externalId,
            title: input.title,
            status: input.status,
            data: input.data
          });
        },
        async list(query) {
          return callHost("entities.list", {
            entityType: query.entityType,
            scopeKind: query.scopeKind,
            scopeId: query.scopeId,
            externalId: query.externalId,
            limit: query.limit,
            offset: query.offset
          });
        }
      },
      projects: {
        async list(input) {
          return callHost("projects.list", {
            companyId: input.companyId,
            limit: input.limit,
            offset: input.offset
          });
        },
        async get(projectId, companyId) {
          return callHost("projects.get", { projectId, companyId });
        },
        async listWorkspaces(projectId, companyId) {
          return callHost("projects.listWorkspaces", { projectId, companyId });
        },
        async getPrimaryWorkspace(projectId, companyId) {
          return callHost("projects.getPrimaryWorkspace", { projectId, companyId });
        },
        async getWorkspaceForIssue(issueId, companyId) {
          return callHost("projects.getWorkspaceForIssue", { issueId, companyId });
        }
      },
      companies: {
        async list(input) {
          return callHost("companies.list", {
            limit: input?.limit,
            offset: input?.offset
          });
        },
        async get(companyId) {
          return callHost("companies.get", { companyId });
        }
      },
      issues: {
        async list(input) {
          return callHost("issues.list", {
            companyId: input.companyId,
            projectId: input.projectId,
            assigneeAgentId: input.assigneeAgentId,
            status: input.status,
            limit: input.limit,
            offset: input.offset
          });
        },
        async get(issueId, companyId) {
          return callHost("issues.get", { issueId, companyId });
        },
        async create(input) {
          return callHost("issues.create", {
            companyId: input.companyId,
            projectId: input.projectId,
            goalId: input.goalId,
            parentId: input.parentId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            assigneeAgentId: input.assigneeAgentId
          });
        },
        async update(issueId, patch, companyId) {
          return callHost("issues.update", {
            issueId,
            patch,
            companyId
          });
        },
        async listComments(issueId, companyId) {
          return callHost("issues.listComments", { issueId, companyId });
        },
        async createComment(issueId, body, companyId) {
          return callHost("issues.createComment", { issueId, body, companyId });
        },
        documents: {
          async list(issueId, companyId) {
            return callHost("issues.documents.list", { issueId, companyId });
          },
          async get(issueId, key, companyId) {
            return callHost("issues.documents.get", { issueId, key, companyId });
          },
          async upsert(input) {
            return callHost("issues.documents.upsert", {
              issueId: input.issueId,
              key: input.key,
              body: input.body,
              companyId: input.companyId,
              title: input.title,
              format: input.format,
              changeSummary: input.changeSummary
            });
          },
          async delete(issueId, key, companyId) {
            return callHost("issues.documents.delete", { issueId, key, companyId });
          }
        }
      },
      agents: {
        async list(input) {
          return callHost("agents.list", {
            companyId: input.companyId,
            status: input.status,
            limit: input.limit,
            offset: input.offset
          });
        },
        async get(agentId, companyId) {
          return callHost("agents.get", { agentId, companyId });
        },
        async pause(agentId, companyId) {
          return callHost("agents.pause", { agentId, companyId });
        },
        async resume(agentId, companyId) {
          return callHost("agents.resume", { agentId, companyId });
        },
        async invoke(agentId, companyId, opts) {
          return callHost("agents.invoke", { agentId, companyId, prompt: opts.prompt, reason: opts.reason });
        },
        sessions: {
          async create(agentId, companyId, opts) {
            return callHost("agents.sessions.create", {
              agentId,
              companyId,
              taskKey: opts?.taskKey,
              reason: opts?.reason
            });
          },
          async list(agentId, companyId) {
            return callHost("agents.sessions.list", { agentId, companyId });
          },
          async sendMessage(sessionId, companyId, opts) {
            if (opts.onEvent) {
              sessionEventCallbacks.set(sessionId, opts.onEvent);
            }
            try {
              return await callHost("agents.sessions.sendMessage", {
                sessionId,
                companyId,
                prompt: opts.prompt,
                reason: opts.reason
              });
            } catch (err) {
              sessionEventCallbacks.delete(sessionId);
              throw err;
            }
          },
          async close(sessionId, companyId) {
            sessionEventCallbacks.delete(sessionId);
            await callHost("agents.sessions.close", { sessionId, companyId });
          }
        }
      },
      goals: {
        async list(input) {
          return callHost("goals.list", {
            companyId: input.companyId,
            level: input.level,
            status: input.status,
            limit: input.limit,
            offset: input.offset
          });
        },
        async get(goalId, companyId) {
          return callHost("goals.get", { goalId, companyId });
        },
        async create(input) {
          return callHost("goals.create", {
            companyId: input.companyId,
            title: input.title,
            description: input.description,
            level: input.level,
            status: input.status,
            parentId: input.parentId,
            ownerAgentId: input.ownerAgentId
          });
        },
        async update(goalId, patch, companyId) {
          return callHost("goals.update", {
            goalId,
            patch,
            companyId
          });
        }
      },
      data: {
        register(key, handler) {
          dataHandlers.set(key, handler);
        }
      },
      actions: {
        register(key, handler) {
          actionHandlers.set(key, handler);
        }
      },
      streams: /* @__PURE__ */ (() => {
        const channelCompanyMap = /* @__PURE__ */ new Map();
        return {
          open(channel, companyId) {
            channelCompanyMap.set(channel, companyId);
            notifyHost("streams.open", { channel, companyId });
          },
          emit(channel, event) {
            const companyId = channelCompanyMap.get(channel) ?? "";
            notifyHost("streams.emit", { channel, companyId, event });
          },
          close(channel) {
            const companyId = channelCompanyMap.get(channel) ?? "";
            channelCompanyMap.delete(channel);
            notifyHost("streams.close", { channel, companyId });
          }
        };
      })(),
      tools: {
        register(name, declaration, fn) {
          toolHandlers.set(name, { declaration, fn });
        }
      },
      metrics: {
        async write(name, value, tags) {
          await callHost("metrics.write", { name, value, tags });
        }
      },
      logger: {
        info(message, meta) {
          notifyHost("log", { level: "info", message, meta });
        },
        warn(message, meta) {
          notifyHost("log", { level: "warn", message, meta });
        },
        error(message, meta) {
          notifyHost("log", { level: "error", message, meta });
        },
        debug(message, meta) {
          notifyHost("log", { level: "debug", message, meta });
        }
      }
    };
  }
  const ctx = buildContext();
  async function handleHostRequest(request) {
    const { id, method, params } = request;
    try {
      const result = await dispatchMethod(method, params);
      sendMessage(createSuccessResponse(id, result ?? null));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = typeof err?.code === "number" ? err.code : PLUGIN_RPC_ERROR_CODES.WORKER_ERROR;
      sendMessage(createErrorResponse(id, errorCode, errorMessage));
    }
  }
  async function dispatchMethod(method, params) {
    switch (method) {
      case "initialize":
        return handleInitialize(params);
      case "health":
        return handleHealth();
      case "shutdown":
        return handleShutdown();
      case "validateConfig":
        return handleValidateConfig(params);
      case "configChanged":
        return handleConfigChanged(params);
      case "onEvent":
        return handleOnEvent(params);
      case "runJob":
        return handleRunJob(params);
      case "handleWebhook":
        return handleWebhook(params);
      case "getData":
        return handleGetData(params);
      case "performAction":
        return handlePerformAction(params);
      case "executeTool":
        return handleExecuteTool(params);
      default:
        throw Object.assign(new Error(`Unknown method: ${method}`), { code: JSONRPC_ERROR_CODES.METHOD_NOT_FOUND });
    }
  }
  async function handleInitialize(params) {
    if (initialized) {
      throw new Error("Worker already initialized");
    }
    manifest2 = params.manifest;
    currentConfig = params.config;
    await plugin2.definition.setup(ctx);
    initialized = true;
    const supportedMethods = [];
    if (plugin2.definition.onValidateConfig)
      supportedMethods.push("validateConfig");
    if (plugin2.definition.onConfigChanged)
      supportedMethods.push("configChanged");
    if (plugin2.definition.onHealth)
      supportedMethods.push("health");
    if (plugin2.definition.onShutdown)
      supportedMethods.push("shutdown");
    return { ok: true, supportedMethods };
  }
  async function handleHealth() {
    if (plugin2.definition.onHealth) {
      return plugin2.definition.onHealth();
    }
    return { status: "ok" };
  }
  async function handleShutdown() {
    if (plugin2.definition.onShutdown) {
      await plugin2.definition.onShutdown();
    }
    setImmediate(() => {
      cleanup();
      if (!options.stdin && !options.stdout) {
        process.exit(0);
      }
    });
  }
  async function handleValidateConfig(params) {
    if (!plugin2.definition.onValidateConfig) {
      throw Object.assign(new Error("validateConfig is not implemented by this plugin"), { code: PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED });
    }
    return plugin2.definition.onValidateConfig(params.config);
  }
  async function handleConfigChanged(params) {
    currentConfig = params.config;
    if (plugin2.definition.onConfigChanged) {
      await plugin2.definition.onConfigChanged(params.config);
    }
  }
  async function handleOnEvent(params) {
    const event = params.event;
    for (const registration of eventHandlers) {
      const exactMatch = registration.name === event.eventType;
      const wildcardPluginAll = registration.name === "plugin.*" && event.eventType.startsWith("plugin.");
      const wildcardPluginOne = registration.name.endsWith(".*") && event.eventType.startsWith(registration.name.slice(0, -1));
      if (!exactMatch && !wildcardPluginAll && !wildcardPluginOne)
        continue;
      if (registration.filter && !allowsEvent(registration.filter, event))
        continue;
      try {
        await registration.fn(event);
      } catch (err) {
        notifyHost("log", {
          level: "error",
          message: `Event handler for "${registration.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
          meta: { eventType: event.eventType, stack: err instanceof Error ? err.stack : void 0 }
        });
      }
    }
  }
  async function handleRunJob(params) {
    const handler = jobHandlers.get(params.job.jobKey);
    if (!handler) {
      throw new Error(`No handler registered for job "${params.job.jobKey}"`);
    }
    await handler(params.job);
  }
  async function handleWebhook(params) {
    if (!plugin2.definition.onWebhook) {
      throw Object.assign(new Error("handleWebhook is not implemented by this plugin"), { code: PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED });
    }
    await plugin2.definition.onWebhook(params);
  }
  async function handleGetData(params) {
    const handler = dataHandlers.get(params.key);
    if (!handler) {
      throw new Error(`No data handler registered for key "${params.key}"`);
    }
    return handler(params.renderEnvironment === void 0 ? params.params : { ...params.params, renderEnvironment: params.renderEnvironment });
  }
  async function handlePerformAction(params) {
    const handler = actionHandlers.get(params.key);
    if (!handler) {
      throw new Error(`No action handler registered for key "${params.key}"`);
    }
    return handler(params.renderEnvironment === void 0 ? params.params : { ...params.params, renderEnvironment: params.renderEnvironment });
  }
  async function handleExecuteTool(params) {
    const entry = toolHandlers.get(params.toolName);
    if (!entry) {
      throw new Error(`No tool handler registered for "${params.toolName}"`);
    }
    return entry.fn(params.parameters, params.runContext);
  }
  function allowsEvent(filter, event) {
    const payload = event.payload;
    if (filter.companyId !== void 0) {
      const companyId = event.companyId ?? String(payload?.companyId ?? "");
      if (companyId !== filter.companyId)
        return false;
    }
    if (filter.projectId !== void 0) {
      const projectId = event.entityType === "project" ? event.entityId : String(payload?.projectId ?? "");
      if (projectId !== filter.projectId)
        return false;
    }
    if (filter.agentId !== void 0) {
      const agentId = event.entityType === "agent" ? event.entityId : String(payload?.agentId ?? "");
      if (agentId !== filter.agentId)
        return false;
    }
    return true;
  }
  function handleHostResponse(response) {
    const id = response.id;
    if (id === null || id === void 0)
      return;
    const pending = pendingRequests.get(id);
    if (!pending)
      return;
    clearTimeout(pending.timer);
    pendingRequests.delete(id);
    pending.resolve(response);
  }
  function handleLine(line) {
    if (!line.trim())
      return;
    let message;
    try {
      message = parseMessage(line);
    } catch (err) {
      if (err instanceof JsonRpcParseError) {
        sendMessage(createErrorResponse(null, JSONRPC_ERROR_CODES.PARSE_ERROR, `Parse error: ${err.message}`));
      }
      return;
    }
    if (isJsonRpcResponse(message)) {
      handleHostResponse(message);
    } else if (isJsonRpcRequest(message)) {
      handleHostRequest(message).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorCode = err?.code ?? PLUGIN_RPC_ERROR_CODES.WORKER_ERROR;
        try {
          sendMessage(createErrorResponse(message.id, typeof errorCode === "number" ? errorCode : PLUGIN_RPC_ERROR_CODES.WORKER_ERROR, errorMessage));
        } catch {
        }
      });
    } else if (isJsonRpcNotification(message)) {
      const notif = message;
      if (notif.method === "agents.sessions.event" && notif.params) {
        const event = notif.params;
        const cb = sessionEventCallbacks.get(event.sessionId);
        if (cb)
          cb(event);
      } else if (notif.method === "onEvent" && notif.params) {
        handleOnEvent(notif.params).catch((err) => {
          notifyHost("log", {
            level: "error",
            message: `Failed to handle event notification: ${err instanceof Error ? err.message : String(err)}`
          });
        });
      }
    }
  }
  function cleanup() {
    running = false;
    if (readline) {
      readline.close();
      readline = null;
    }
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.resolve(createErrorResponse(id, PLUGIN_RPC_ERROR_CODES.WORKER_UNAVAILABLE, "Worker RPC host is shutting down"));
    }
    pendingRequests.clear();
    sessionEventCallbacks.clear();
  }
  let readline = createInterface({
    input: stdinStream,
    crlfDelay: Infinity
  });
  readline.on("line", handleLine);
  readline.on("close", () => {
    if (running) {
      cleanup();
      if (!options.stdin && !options.stdout) {
        process.exit(0);
      }
    }
  });
  if (!options.stdin && !options.stdout) {
    process.on("uncaughtException", (err) => {
      notifyHost("log", {
        level: "error",
        message: `Uncaught exception: ${err.message}`,
        meta: { stack: err.stack }
      });
      setTimeout(() => process.exit(1), 100);
    });
    process.on("unhandledRejection", (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : void 0;
      notifyHost("log", {
        level: "error",
        message: `Unhandled rejection: ${message}`,
        meta: { stack }
      });
    });
  }
  return {
    get running() {
      return running;
    },
    stop() {
      cleanup();
    }
  };
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path2, errorMaps, issueData } = params;
  const fullPath = [...path2, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path2, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path2;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/constants.js
var COMPANY_STATUSES = ["active", "paused", "archived"];
var DEPLOYMENT_MODES = ["local_trusted", "authenticated"];
var DEPLOYMENT_EXPOSURES = ["private", "public"];
var AUTH_BASE_URL_MODES = ["auto", "explicit"];
var AGENT_STATUSES = [
  "active",
  "paused",
  "idle",
  "running",
  "error",
  "pending_approval",
  "terminated"
];
var AGENT_ADAPTER_TYPES = [
  "process",
  "http",
  "claude_local",
  "codex_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "openclaw_gateway",
  "hermes_local"
];
var AGENT_ROLES = [
  "ceo",
  "cto",
  "cmo",
  "cfo",
  "engineer",
  "designer",
  "pm",
  "qa",
  "devops",
  "researcher",
  "general"
];
var AGENT_ICON_NAMES = [
  "bot",
  "cpu",
  "brain",
  "zap",
  "rocket",
  "code",
  "terminal",
  "shield",
  "eye",
  "search",
  "wrench",
  "hammer",
  "lightbulb",
  "sparkles",
  "star",
  "heart",
  "flame",
  "bug",
  "cog",
  "database",
  "globe",
  "lock",
  "mail",
  "message-square",
  "file-code",
  "git-branch",
  "package",
  "puzzle",
  "target",
  "wand",
  "atom",
  "circuit-board",
  "radar",
  "swords",
  "telescope",
  "microscope",
  "crown",
  "gem",
  "hexagon",
  "pentagon",
  "fingerprint"
];
var ISSUE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled"
];
var ISSUE_PRIORITIES = ["critical", "high", "medium", "low"];
var GOAL_LEVELS = ["company", "team", "agent", "task"];
var GOAL_STATUSES = ["planned", "active", "achieved", "cancelled"];
var PROJECT_STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "completed",
  "cancelled"
];
var ROUTINE_STATUSES = ["active", "paused", "archived"];
var ROUTINE_CONCURRENCY_POLICIES = ["coalesce_if_active", "always_enqueue", "skip_if_active"];
var ROUTINE_CATCH_UP_POLICIES = ["skip_missed", "enqueue_missed_with_cap"];
var ROUTINE_TRIGGER_SIGNING_MODES = ["bearer", "hmac_sha256"];
var APPROVAL_TYPES = ["hire_agent", "approve_ceo_strategy", "budget_override_required"];
var SECRET_PROVIDERS = [
  "local_encrypted",
  "aws_secrets_manager",
  "gcp_secret_manager",
  "vault"
];
var STORAGE_PROVIDERS = ["local_disk", "s3"];
var BILLING_TYPES = [
  "metered_api",
  "subscription_included",
  "subscription_overage",
  "credits",
  "fixed",
  "unknown"
];
var FINANCE_EVENT_KINDS = [
  "inference_charge",
  "platform_fee",
  "credit_purchase",
  "credit_refund",
  "credit_expiry",
  "byok_fee",
  "gateway_overhead",
  "log_storage_charge",
  "logpush_charge",
  "provisioned_capacity_charge",
  "training_charge",
  "custom_model_import_charge",
  "custom_model_storage_charge",
  "manual_adjustment"
];
var FINANCE_DIRECTIONS = ["debit", "credit"];
var FINANCE_UNITS = [
  "input_token",
  "output_token",
  "cached_input_token",
  "request",
  "credit_usd",
  "credit_unit",
  "model_unit_minute",
  "model_unit_hour",
  "gb_month",
  "train_token",
  "unknown"
];
var BUDGET_SCOPE_TYPES = ["company", "agent", "project"];
var BUDGET_METRICS = ["billed_cents"];
var BUDGET_WINDOW_KINDS = ["calendar_month_utc", "lifetime"];
var BUDGET_INCIDENT_RESOLUTION_ACTIONS = [
  "keep_paused",
  "raise_budget_and_resume"
];
var INVITE_JOIN_TYPES = ["human", "agent", "both"];
var JOIN_REQUEST_TYPES = ["human", "agent"];
var JOIN_REQUEST_STATUSES = ["pending_approval", "approved", "rejected"];
var PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve"
];
var PLUGIN_STATUSES = [
  "installed",
  "ready",
  "disabled",
  "error",
  "upgrade_pending",
  "uninstalled"
];
var PLUGIN_CATEGORIES = [
  "connector",
  "workspace",
  "automation",
  "ui"
];
var PLUGIN_CAPABILITIES = [
  // Data Read
  "companies.read",
  "projects.read",
  "project.workspaces.read",
  "issues.read",
  "issue.comments.read",
  "issue.documents.read",
  "agents.read",
  "goals.read",
  "goals.create",
  "goals.update",
  "activity.read",
  "costs.read",
  // Data Write
  "issues.create",
  "issues.update",
  "issue.comments.create",
  "issue.documents.write",
  "agents.pause",
  "agents.resume",
  "agents.invoke",
  "agent.sessions.create",
  "agent.sessions.list",
  "agent.sessions.send",
  "agent.sessions.close",
  "activity.log.write",
  "metrics.write",
  // Plugin State
  "plugin.state.read",
  "plugin.state.write",
  // Runtime / Integration
  "events.subscribe",
  "events.emit",
  "jobs.schedule",
  "webhooks.receive",
  "http.outbound",
  "secrets.read-ref",
  // Agent Tools
  "agent.tools.register",
  // UI
  "instance.settings.register",
  "ui.sidebar.register",
  "ui.page.register",
  "ui.detailTab.register",
  "ui.dashboardWidget.register",
  "ui.commentAnnotation.register",
  "ui.action.register"
];
var PLUGIN_UI_SLOT_TYPES = [
  "page",
  "detailTab",
  "taskDetailView",
  "dashboardWidget",
  "sidebar",
  "sidebarPanel",
  "projectSidebarItem",
  "globalToolbarButton",
  "toolbarButton",
  "contextMenuItem",
  "commentAnnotation",
  "commentContextMenuItem",
  "settingsPage"
];
var PLUGIN_RESERVED_COMPANY_ROUTE_SEGMENTS = [
  "dashboard",
  "onboarding",
  "companies",
  "company",
  "settings",
  "plugins",
  "org",
  "agents",
  "projects",
  "issues",
  "goals",
  "approvals",
  "costs",
  "activity",
  "inbox",
  "design-guide",
  "tests"
];
var PLUGIN_LAUNCHER_PLACEMENT_ZONES = [
  "page",
  "detailTab",
  "taskDetailView",
  "dashboardWidget",
  "sidebar",
  "sidebarPanel",
  "projectSidebarItem",
  "globalToolbarButton",
  "toolbarButton",
  "contextMenuItem",
  "commentAnnotation",
  "commentContextMenuItem",
  "settingsPage"
];
var PLUGIN_LAUNCHER_ACTIONS = [
  "navigate",
  "openModal",
  "openDrawer",
  "openPopover",
  "performAction",
  "deepLink"
];
var PLUGIN_LAUNCHER_BOUNDS = [
  "inline",
  "compact",
  "default",
  "wide",
  "full"
];
var PLUGIN_LAUNCHER_RENDER_ENVIRONMENTS = [
  "hostInline",
  "hostOverlay",
  "hostRoute",
  "external",
  "iframe"
];
var PLUGIN_UI_SLOT_ENTITY_TYPES = [
  "project",
  "issue",
  "agent",
  "goal",
  "run",
  "comment"
];
var PLUGIN_STATE_SCOPE_KINDS = [
  "instance",
  "company",
  "project",
  "project_workspace",
  "agent",
  "issue",
  "goal",
  "run"
];

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/instance.js
var instanceGeneralSettingsSchema = external_exports.object({
  censorUsernameInLogs: external_exports.boolean().default(false)
}).strict();
var patchInstanceGeneralSettingsSchema = instanceGeneralSettingsSchema.partial();
var instanceExperimentalSettingsSchema = external_exports.object({
  enableIsolatedWorkspaces: external_exports.boolean().default(false),
  autoRestartDevServerWhenIdle: external_exports.boolean().default(false)
}).strict();
var patchInstanceExperimentalSettingsSchema = instanceExperimentalSettingsSchema.partial();

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/budget.js
var upsertBudgetPolicySchema = external_exports.object({
  scopeType: external_exports.enum(BUDGET_SCOPE_TYPES),
  scopeId: external_exports.string().uuid(),
  metric: external_exports.enum(BUDGET_METRICS).optional().default("billed_cents"),
  windowKind: external_exports.enum(BUDGET_WINDOW_KINDS).optional().default("calendar_month_utc"),
  amount: external_exports.number().int().nonnegative(),
  warnPercent: external_exports.number().int().min(1).max(99).optional().default(80),
  hardStopEnabled: external_exports.boolean().optional().default(true),
  notifyEnabled: external_exports.boolean().optional().default(true),
  isActive: external_exports.boolean().optional().default(true)
});
var resolveBudgetIncidentSchema = external_exports.object({
  action: external_exports.enum(BUDGET_INCIDENT_RESOLUTION_ACTIONS),
  amount: external_exports.number().int().nonnegative().optional(),
  decisionNote: external_exports.string().optional().nullable()
}).superRefine((value, ctx) => {
  if (value.action === "raise_budget_and_resume" && typeof value.amount !== "number") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "amount is required when raising a budget",
      path: ["amount"]
    });
  }
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/company.js
var logoAssetIdSchema = external_exports.string().uuid().nullable().optional();
var brandColorSchema = external_exports.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional();
var createCompanySchema = external_exports.object({
  name: external_exports.string().min(1),
  description: external_exports.string().optional().nullable(),
  budgetMonthlyCents: external_exports.number().int().nonnegative().optional().default(0)
});
var updateCompanySchema = createCompanySchema.partial().extend({
  status: external_exports.enum(COMPANY_STATUSES).optional(),
  spentMonthlyCents: external_exports.number().int().nonnegative().optional(),
  requireBoardApprovalForNewAgents: external_exports.boolean().optional(),
  brandColor: brandColorSchema,
  logoAssetId: logoAssetIdSchema
});
var updateCompanyBrandingSchema = external_exports.object({
  name: external_exports.string().min(1).optional(),
  description: external_exports.string().nullable().optional(),
  brandColor: brandColorSchema,
  logoAssetId: logoAssetIdSchema
}).strict().refine((value) => value.name !== void 0 || value.description !== void 0 || value.brandColor !== void 0 || value.logoAssetId !== void 0, "At least one branding field must be provided");

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/company-skill.js
var companySkillSourceTypeSchema = external_exports.enum(["local_path", "github", "url", "catalog", "skills_sh"]);
var companySkillTrustLevelSchema = external_exports.enum(["markdown_only", "assets", "scripts_executables"]);
var companySkillCompatibilitySchema = external_exports.enum(["compatible", "unknown", "invalid"]);
var companySkillSourceBadgeSchema = external_exports.enum(["paperclip", "github", "local", "url", "catalog", "skills_sh"]);
var companySkillFileInventoryEntrySchema = external_exports.object({
  path: external_exports.string().min(1),
  kind: external_exports.enum(["skill", "markdown", "reference", "script", "asset", "other"])
});
var companySkillSchema = external_exports.object({
  id: external_exports.string().uuid(),
  companyId: external_exports.string().uuid(),
  key: external_exports.string().min(1),
  slug: external_exports.string().min(1),
  name: external_exports.string().min(1),
  description: external_exports.string().nullable(),
  markdown: external_exports.string(),
  sourceType: companySkillSourceTypeSchema,
  sourceLocator: external_exports.string().nullable(),
  sourceRef: external_exports.string().nullable(),
  trustLevel: companySkillTrustLevelSchema,
  compatibility: companySkillCompatibilitySchema,
  fileInventory: external_exports.array(companySkillFileInventoryEntrySchema).default([]),
  metadata: external_exports.record(external_exports.unknown()).nullable(),
  createdAt: external_exports.coerce.date(),
  updatedAt: external_exports.coerce.date()
});
var companySkillListItemSchema = companySkillSchema.extend({
  attachedAgentCount: external_exports.number().int().nonnegative(),
  editable: external_exports.boolean(),
  editableReason: external_exports.string().nullable(),
  sourceLabel: external_exports.string().nullable(),
  sourceBadge: companySkillSourceBadgeSchema
});
var companySkillUsageAgentSchema = external_exports.object({
  id: external_exports.string().uuid(),
  name: external_exports.string().min(1),
  urlKey: external_exports.string().min(1),
  adapterType: external_exports.string().min(1),
  desired: external_exports.boolean(),
  actualState: external_exports.string().nullable()
});
var companySkillDetailSchema = companySkillSchema.extend({
  attachedAgentCount: external_exports.number().int().nonnegative(),
  usedByAgents: external_exports.array(companySkillUsageAgentSchema).default([]),
  editable: external_exports.boolean(),
  editableReason: external_exports.string().nullable(),
  sourceLabel: external_exports.string().nullable(),
  sourceBadge: companySkillSourceBadgeSchema
});
var companySkillUpdateStatusSchema = external_exports.object({
  supported: external_exports.boolean(),
  reason: external_exports.string().nullable(),
  trackingRef: external_exports.string().nullable(),
  currentRef: external_exports.string().nullable(),
  latestRef: external_exports.string().nullable(),
  hasUpdate: external_exports.boolean()
});
var companySkillImportSchema = external_exports.object({
  source: external_exports.string().min(1)
});
var companySkillProjectScanRequestSchema = external_exports.object({
  projectIds: external_exports.array(external_exports.string().uuid()).optional(),
  workspaceIds: external_exports.array(external_exports.string().uuid()).optional()
});
var companySkillProjectScanSkippedSchema = external_exports.object({
  projectId: external_exports.string().uuid(),
  projectName: external_exports.string().min(1),
  workspaceId: external_exports.string().uuid().nullable(),
  workspaceName: external_exports.string().nullable(),
  path: external_exports.string().nullable(),
  reason: external_exports.string().min(1)
});
var companySkillProjectScanConflictSchema = external_exports.object({
  slug: external_exports.string().min(1),
  key: external_exports.string().min(1),
  projectId: external_exports.string().uuid(),
  projectName: external_exports.string().min(1),
  workspaceId: external_exports.string().uuid(),
  workspaceName: external_exports.string().min(1),
  path: external_exports.string().min(1),
  existingSkillId: external_exports.string().uuid(),
  existingSkillKey: external_exports.string().min(1),
  existingSourceLocator: external_exports.string().nullable(),
  reason: external_exports.string().min(1)
});
var companySkillProjectScanResultSchema = external_exports.object({
  scannedProjects: external_exports.number().int().nonnegative(),
  scannedWorkspaces: external_exports.number().int().nonnegative(),
  discovered: external_exports.number().int().nonnegative(),
  imported: external_exports.array(companySkillSchema),
  updated: external_exports.array(companySkillSchema),
  skipped: external_exports.array(companySkillProjectScanSkippedSchema),
  conflicts: external_exports.array(companySkillProjectScanConflictSchema),
  warnings: external_exports.array(external_exports.string())
});
var companySkillCreateSchema = external_exports.object({
  name: external_exports.string().min(1),
  slug: external_exports.string().min(1).nullable().optional(),
  description: external_exports.string().nullable().optional(),
  markdown: external_exports.string().nullable().optional()
});
var companySkillFileDetailSchema = external_exports.object({
  skillId: external_exports.string().uuid(),
  path: external_exports.string().min(1),
  kind: external_exports.enum(["skill", "markdown", "reference", "script", "asset", "other"]),
  content: external_exports.string(),
  language: external_exports.string().nullable(),
  markdown: external_exports.boolean(),
  editable: external_exports.boolean()
});
var companySkillFileUpdateSchema = external_exports.object({
  path: external_exports.string().min(1),
  content: external_exports.string()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/adapter-skills.js
var agentSkillStateSchema = external_exports.enum([
  "available",
  "configured",
  "installed",
  "missing",
  "stale",
  "external"
]);
var agentSkillOriginSchema = external_exports.enum([
  "company_managed",
  "paperclip_required",
  "user_installed",
  "external_unknown"
]);
var agentSkillSyncModeSchema = external_exports.enum([
  "unsupported",
  "persistent",
  "ephemeral"
]);
var agentSkillEntrySchema = external_exports.object({
  key: external_exports.string().min(1),
  runtimeName: external_exports.string().min(1).nullable(),
  desired: external_exports.boolean(),
  managed: external_exports.boolean(),
  required: external_exports.boolean().optional(),
  requiredReason: external_exports.string().nullable().optional(),
  state: agentSkillStateSchema,
  origin: agentSkillOriginSchema.optional(),
  originLabel: external_exports.string().nullable().optional(),
  locationLabel: external_exports.string().nullable().optional(),
  readOnly: external_exports.boolean().optional(),
  sourcePath: external_exports.string().nullable().optional(),
  targetPath: external_exports.string().nullable().optional(),
  detail: external_exports.string().nullable().optional()
});
var agentSkillSnapshotSchema = external_exports.object({
  adapterType: external_exports.string().min(1),
  supported: external_exports.boolean(),
  mode: agentSkillSyncModeSchema,
  desiredSkills: external_exports.array(external_exports.string().min(1)),
  entries: external_exports.array(agentSkillEntrySchema),
  warnings: external_exports.array(external_exports.string())
});
var agentSkillSyncSchema = external_exports.object({
  desiredSkills: external_exports.array(external_exports.string().min(1))
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/company-portability.js
var portabilityIncludeSchema = external_exports.object({
  company: external_exports.boolean().optional(),
  agents: external_exports.boolean().optional(),
  projects: external_exports.boolean().optional(),
  issues: external_exports.boolean().optional(),
  skills: external_exports.boolean().optional()
}).partial();
var portabilityEnvInputSchema = external_exports.object({
  key: external_exports.string().min(1),
  description: external_exports.string().nullable(),
  agentSlug: external_exports.string().min(1).nullable(),
  kind: external_exports.enum(["secret", "plain"]),
  requirement: external_exports.enum(["required", "optional"]),
  defaultValue: external_exports.string().nullable(),
  portability: external_exports.enum(["portable", "system_dependent"])
});
var portabilityFileEntrySchema = external_exports.union([
  external_exports.string(),
  external_exports.object({
    encoding: external_exports.literal("base64"),
    data: external_exports.string(),
    contentType: external_exports.string().min(1).optional().nullable()
  })
]);
var portabilityCompanyManifestEntrySchema = external_exports.object({
  path: external_exports.string().min(1),
  name: external_exports.string().min(1),
  description: external_exports.string().nullable(),
  brandColor: external_exports.string().nullable(),
  logoPath: external_exports.string().nullable(),
  requireBoardApprovalForNewAgents: external_exports.boolean()
});
var portabilitySidebarOrderSchema = external_exports.object({
  agents: external_exports.array(external_exports.string().min(1)).default([]),
  projects: external_exports.array(external_exports.string().min(1)).default([])
});
var portabilityAgentManifestEntrySchema = external_exports.object({
  slug: external_exports.string().min(1),
  name: external_exports.string().min(1),
  path: external_exports.string().min(1),
  skills: external_exports.array(external_exports.string().min(1)).default([]),
  role: external_exports.string().min(1),
  title: external_exports.string().nullable(),
  icon: external_exports.string().nullable(),
  capabilities: external_exports.string().nullable(),
  reportsToSlug: external_exports.string().min(1).nullable(),
  adapterType: external_exports.string().min(1),
  adapterConfig: external_exports.record(external_exports.unknown()),
  runtimeConfig: external_exports.record(external_exports.unknown()),
  permissions: external_exports.record(external_exports.unknown()),
  budgetMonthlyCents: external_exports.number().int().nonnegative(),
  metadata: external_exports.record(external_exports.unknown()).nullable()
});
var portabilitySkillManifestEntrySchema = external_exports.object({
  key: external_exports.string().min(1),
  slug: external_exports.string().min(1),
  name: external_exports.string().min(1),
  path: external_exports.string().min(1),
  description: external_exports.string().nullable(),
  sourceType: external_exports.string().min(1),
  sourceLocator: external_exports.string().nullable(),
  sourceRef: external_exports.string().nullable(),
  trustLevel: external_exports.string().nullable(),
  compatibility: external_exports.string().nullable(),
  metadata: external_exports.record(external_exports.unknown()).nullable(),
  fileInventory: external_exports.array(external_exports.object({
    path: external_exports.string().min(1),
    kind: external_exports.string().min(1)
  })).default([])
});
var portabilityProjectManifestEntrySchema = external_exports.object({
  slug: external_exports.string().min(1),
  name: external_exports.string().min(1),
  path: external_exports.string().min(1),
  description: external_exports.string().nullable(),
  ownerAgentSlug: external_exports.string().min(1).nullable(),
  leadAgentSlug: external_exports.string().min(1).nullable(),
  targetDate: external_exports.string().nullable(),
  color: external_exports.string().nullable(),
  status: external_exports.string().nullable(),
  executionWorkspacePolicy: external_exports.record(external_exports.unknown()).nullable(),
  workspaces: external_exports.array(external_exports.object({
    key: external_exports.string().min(1),
    name: external_exports.string().min(1),
    sourceType: external_exports.string().nullable(),
    repoUrl: external_exports.string().nullable(),
    repoRef: external_exports.string().nullable(),
    defaultRef: external_exports.string().nullable(),
    visibility: external_exports.string().nullable(),
    setupCommand: external_exports.string().nullable(),
    cleanupCommand: external_exports.string().nullable(),
    metadata: external_exports.record(external_exports.unknown()).nullable(),
    isPrimary: external_exports.boolean()
  })).default([]),
  metadata: external_exports.record(external_exports.unknown()).nullable()
});
var portabilityIssueRoutineTriggerManifestEntrySchema = external_exports.object({
  kind: external_exports.string().min(1),
  label: external_exports.string().nullable(),
  enabled: external_exports.boolean(),
  cronExpression: external_exports.string().nullable(),
  timezone: external_exports.string().nullable(),
  signingMode: external_exports.string().nullable(),
  replayWindowSec: external_exports.number().int().nullable()
});
var portabilityIssueRoutineManifestEntrySchema = external_exports.object({
  concurrencyPolicy: external_exports.string().nullable(),
  catchUpPolicy: external_exports.string().nullable(),
  triggers: external_exports.array(portabilityIssueRoutineTriggerManifestEntrySchema).default([])
});
var portabilityIssueManifestEntrySchema = external_exports.object({
  slug: external_exports.string().min(1),
  identifier: external_exports.string().min(1).nullable(),
  title: external_exports.string().min(1),
  path: external_exports.string().min(1),
  projectSlug: external_exports.string().min(1).nullable(),
  projectWorkspaceKey: external_exports.string().min(1).nullable(),
  assigneeAgentSlug: external_exports.string().min(1).nullable(),
  description: external_exports.string().nullable(),
  recurring: external_exports.boolean().default(false),
  routine: portabilityIssueRoutineManifestEntrySchema.nullable(),
  legacyRecurrence: external_exports.record(external_exports.unknown()).nullable(),
  status: external_exports.string().nullable(),
  priority: external_exports.string().nullable(),
  labelIds: external_exports.array(external_exports.string().min(1)).default([]),
  billingCode: external_exports.string().nullable(),
  executionWorkspaceSettings: external_exports.record(external_exports.unknown()).nullable(),
  assigneeAdapterOverrides: external_exports.record(external_exports.unknown()).nullable(),
  metadata: external_exports.record(external_exports.unknown()).nullable()
});
var portabilityManifestSchema = external_exports.object({
  schemaVersion: external_exports.number().int().positive(),
  generatedAt: external_exports.string().datetime(),
  source: external_exports.object({
    companyId: external_exports.string().uuid(),
    companyName: external_exports.string().min(1)
  }).nullable(),
  includes: external_exports.object({
    company: external_exports.boolean(),
    agents: external_exports.boolean(),
    projects: external_exports.boolean(),
    issues: external_exports.boolean(),
    skills: external_exports.boolean()
  }),
  company: portabilityCompanyManifestEntrySchema.nullable(),
  sidebar: portabilitySidebarOrderSchema.nullable(),
  agents: external_exports.array(portabilityAgentManifestEntrySchema),
  skills: external_exports.array(portabilitySkillManifestEntrySchema).default([]),
  projects: external_exports.array(portabilityProjectManifestEntrySchema).default([]),
  issues: external_exports.array(portabilityIssueManifestEntrySchema).default([]),
  envInputs: external_exports.array(portabilityEnvInputSchema).default([])
});
var portabilitySourceSchema = external_exports.discriminatedUnion("type", [
  external_exports.object({
    type: external_exports.literal("inline"),
    rootPath: external_exports.string().min(1).optional().nullable(),
    files: external_exports.record(portabilityFileEntrySchema)
  }),
  external_exports.object({
    type: external_exports.literal("github"),
    url: external_exports.string().url()
  })
]);
var portabilityTargetSchema = external_exports.discriminatedUnion("mode", [
  external_exports.object({
    mode: external_exports.literal("new_company"),
    newCompanyName: external_exports.string().min(1).optional().nullable()
  }),
  external_exports.object({
    mode: external_exports.literal("existing_company"),
    companyId: external_exports.string().uuid()
  })
]);
var portabilityAgentSelectionSchema = external_exports.union([
  external_exports.literal("all"),
  external_exports.array(external_exports.string().min(1))
]);
var portabilityCollisionStrategySchema = external_exports.enum(["rename", "skip", "replace"]);
var companyPortabilityExportSchema = external_exports.object({
  include: portabilityIncludeSchema.optional(),
  agents: external_exports.array(external_exports.string().min(1)).optional(),
  skills: external_exports.array(external_exports.string().min(1)).optional(),
  projects: external_exports.array(external_exports.string().min(1)).optional(),
  issues: external_exports.array(external_exports.string().min(1)).optional(),
  projectIssues: external_exports.array(external_exports.string().min(1)).optional(),
  selectedFiles: external_exports.array(external_exports.string().min(1)).optional(),
  expandReferencedSkills: external_exports.boolean().optional(),
  sidebarOrder: portabilitySidebarOrderSchema.partial().optional()
});
var companyPortabilityPreviewSchema = external_exports.object({
  source: portabilitySourceSchema,
  include: portabilityIncludeSchema.optional(),
  target: portabilityTargetSchema,
  agents: portabilityAgentSelectionSchema.optional(),
  collisionStrategy: portabilityCollisionStrategySchema.optional(),
  nameOverrides: external_exports.record(external_exports.string().min(1), external_exports.string().min(1)).optional(),
  selectedFiles: external_exports.array(external_exports.string().min(1)).optional()
});
var portabilityAdapterOverrideSchema = external_exports.object({
  adapterType: external_exports.string().min(1),
  adapterConfig: external_exports.record(external_exports.unknown()).optional()
});
var companyPortabilityImportSchema = companyPortabilityPreviewSchema.extend({
  adapterOverrides: external_exports.record(external_exports.string().min(1), portabilityAdapterOverrideSchema).optional()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/secret.js
var envBindingPlainSchema = external_exports.object({
  type: external_exports.literal("plain"),
  value: external_exports.string()
});
var envBindingSecretRefSchema = external_exports.object({
  type: external_exports.literal("secret_ref"),
  secretId: external_exports.string().uuid(),
  version: external_exports.union([external_exports.literal("latest"), external_exports.number().int().positive()]).optional()
});
var envBindingSchema = external_exports.union([
  external_exports.string(),
  envBindingPlainSchema,
  envBindingSecretRefSchema
]);
var envConfigSchema = external_exports.record(envBindingSchema);
var createSecretSchema = external_exports.object({
  name: external_exports.string().min(1),
  provider: external_exports.enum(SECRET_PROVIDERS).optional(),
  value: external_exports.string().min(1),
  description: external_exports.string().optional().nullable(),
  externalRef: external_exports.string().optional().nullable()
});
var rotateSecretSchema = external_exports.object({
  value: external_exports.string().min(1),
  externalRef: external_exports.string().optional().nullable()
});
var updateSecretSchema = external_exports.object({
  name: external_exports.string().min(1).optional(),
  description: external_exports.string().optional().nullable(),
  externalRef: external_exports.string().optional().nullable()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/agent.js
var agentPermissionsSchema = external_exports.object({
  canCreateAgents: external_exports.boolean().optional().default(false)
});
var agentInstructionsBundleModeSchema = external_exports.enum(["managed", "external"]);
var updateAgentInstructionsBundleSchema = external_exports.object({
  mode: agentInstructionsBundleModeSchema.optional(),
  rootPath: external_exports.string().trim().min(1).nullable().optional(),
  entryFile: external_exports.string().trim().min(1).optional(),
  clearLegacyPromptTemplate: external_exports.boolean().optional().default(false)
});
var upsertAgentInstructionsFileSchema = external_exports.object({
  path: external_exports.string().trim().min(1),
  content: external_exports.string(),
  clearLegacyPromptTemplate: external_exports.boolean().optional().default(false)
});
var adapterConfigSchema = external_exports.record(external_exports.unknown()).superRefine((value, ctx) => {
  const envValue = value.env;
  if (envValue === void 0)
    return;
  const parsed = envConfigSchema.safeParse(envValue);
  if (!parsed.success) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "adapterConfig.env must be a map of valid env bindings",
      path: ["env"]
    });
  }
});
var createAgentSchema = external_exports.object({
  name: external_exports.string().min(1),
  role: external_exports.enum(AGENT_ROLES).optional().default("general"),
  title: external_exports.string().optional().nullable(),
  icon: external_exports.enum(AGENT_ICON_NAMES).optional().nullable(),
  reportsTo: external_exports.string().uuid().optional().nullable(),
  capabilities: external_exports.string().optional().nullable(),
  desiredSkills: external_exports.array(external_exports.string().min(1)).optional(),
  adapterType: external_exports.enum(AGENT_ADAPTER_TYPES).optional().default("process"),
  adapterConfig: adapterConfigSchema.optional().default({}),
  runtimeConfig: external_exports.record(external_exports.unknown()).optional().default({}),
  budgetMonthlyCents: external_exports.number().int().nonnegative().optional().default(0),
  permissions: agentPermissionsSchema.optional(),
  metadata: external_exports.record(external_exports.unknown()).optional().nullable()
});
var createAgentHireSchema = createAgentSchema.extend({
  sourceIssueId: external_exports.string().uuid().optional().nullable(),
  sourceIssueIds: external_exports.array(external_exports.string().uuid()).optional()
});
var updateAgentSchema = createAgentSchema.omit({ permissions: true }).partial().extend({
  permissions: external_exports.never().optional(),
  replaceAdapterConfig: external_exports.boolean().optional(),
  status: external_exports.enum(AGENT_STATUSES).optional(),
  spentMonthlyCents: external_exports.number().int().nonnegative().optional()
});
var updateAgentInstructionsPathSchema = external_exports.object({
  path: external_exports.string().trim().min(1).nullable(),
  adapterConfigKey: external_exports.string().trim().min(1).optional()
});
var createAgentKeySchema = external_exports.object({
  name: external_exports.string().min(1).default("default")
});
var wakeAgentSchema = external_exports.object({
  source: external_exports.enum(["timer", "assignment", "on_demand", "automation"]).optional().default("on_demand"),
  triggerDetail: external_exports.enum(["manual", "ping", "callback", "system"]).optional(),
  reason: external_exports.string().optional().nullable(),
  payload: external_exports.record(external_exports.unknown()).optional().nullable(),
  idempotencyKey: external_exports.string().optional().nullable(),
  forceFreshSession: external_exports.preprocess((value) => value === null ? void 0 : value, external_exports.boolean().optional().default(false))
});
var resetAgentSessionSchema = external_exports.object({
  taskKey: external_exports.string().min(1).optional().nullable()
});
var testAdapterEnvironmentSchema = external_exports.object({
  adapterConfig: adapterConfigSchema.optional().default({})
});
var updateAgentPermissionsSchema = external_exports.object({
  canCreateAgents: external_exports.boolean(),
  canAssignTasks: external_exports.boolean()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/project.js
var executionWorkspaceStrategySchema = external_exports.object({
  type: external_exports.enum(["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]).optional(),
  baseRef: external_exports.string().optional().nullable(),
  branchTemplate: external_exports.string().optional().nullable(),
  worktreeParentDir: external_exports.string().optional().nullable(),
  provisionCommand: external_exports.string().optional().nullable(),
  teardownCommand: external_exports.string().optional().nullable()
}).strict();
var projectExecutionWorkspacePolicySchema = external_exports.object({
  enabled: external_exports.boolean(),
  defaultMode: external_exports.enum(["shared_workspace", "isolated_workspace", "operator_branch", "adapter_default"]).optional(),
  allowIssueOverride: external_exports.boolean().optional(),
  defaultProjectWorkspaceId: external_exports.string().uuid().optional().nullable(),
  workspaceStrategy: executionWorkspaceStrategySchema.optional().nullable(),
  workspaceRuntime: external_exports.record(external_exports.unknown()).optional().nullable(),
  branchPolicy: external_exports.record(external_exports.unknown()).optional().nullable(),
  pullRequestPolicy: external_exports.record(external_exports.unknown()).optional().nullable(),
  runtimePolicy: external_exports.record(external_exports.unknown()).optional().nullable(),
  cleanupPolicy: external_exports.record(external_exports.unknown()).optional().nullable()
}).strict();
var projectWorkspaceSourceTypeSchema = external_exports.enum(["local_path", "git_repo", "remote_managed", "non_git_path"]);
var projectWorkspaceVisibilitySchema = external_exports.enum(["default", "advanced"]);
var projectWorkspaceFields = {
  name: external_exports.string().min(1).optional(),
  sourceType: projectWorkspaceSourceTypeSchema.optional(),
  cwd: external_exports.string().min(1).optional().nullable(),
  repoUrl: external_exports.string().url().optional().nullable(),
  repoRef: external_exports.string().optional().nullable(),
  defaultRef: external_exports.string().optional().nullable(),
  visibility: projectWorkspaceVisibilitySchema.optional(),
  setupCommand: external_exports.string().optional().nullable(),
  cleanupCommand: external_exports.string().optional().nullable(),
  remoteProvider: external_exports.string().optional().nullable(),
  remoteWorkspaceRef: external_exports.string().optional().nullable(),
  sharedWorkspaceKey: external_exports.string().optional().nullable(),
  metadata: external_exports.record(external_exports.unknown()).optional().nullable()
};
function validateProjectWorkspace(value, ctx) {
  const sourceType = value.sourceType ?? "local_path";
  const hasCwd = typeof value.cwd === "string" && value.cwd.trim().length > 0;
  const hasRepo = typeof value.repoUrl === "string" && value.repoUrl.trim().length > 0;
  const hasRemoteRef = typeof value.remoteWorkspaceRef === "string" && value.remoteWorkspaceRef.trim().length > 0;
  if (sourceType === "remote_managed") {
    if (!hasRemoteRef && !hasRepo) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: "Remote-managed workspace requires remoteWorkspaceRef or repoUrl.",
        path: ["remoteWorkspaceRef"]
      });
    }
    return;
  }
  if (!hasCwd && !hasRepo) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "Workspace requires at least one of cwd or repoUrl.",
      path: ["cwd"]
    });
  }
}
var createProjectWorkspaceSchema = external_exports.object({
  ...projectWorkspaceFields,
  isPrimary: external_exports.boolean().optional().default(false)
}).superRefine(validateProjectWorkspace);
var updateProjectWorkspaceSchema = external_exports.object({
  ...projectWorkspaceFields,
  isPrimary: external_exports.boolean().optional()
}).partial();
var projectFields = {
  /** @deprecated Use goalIds instead */
  goalId: external_exports.string().uuid().optional().nullable(),
  goalIds: external_exports.array(external_exports.string().uuid()).optional(),
  name: external_exports.string().min(1),
  description: external_exports.string().optional().nullable(),
  status: external_exports.enum(PROJECT_STATUSES).optional().default("backlog"),
  leadAgentId: external_exports.string().uuid().optional().nullable(),
  targetDate: external_exports.string().optional().nullable(),
  color: external_exports.string().optional().nullable(),
  executionWorkspacePolicy: projectExecutionWorkspacePolicySchema.optional().nullable(),
  archivedAt: external_exports.string().datetime().optional().nullable()
};
var createProjectSchema = external_exports.object({
  ...projectFields,
  workspace: createProjectWorkspaceSchema.optional()
});
var updateProjectSchema = external_exports.object(projectFields).partial();

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/issue.js
var executionWorkspaceStrategySchema2 = external_exports.object({
  type: external_exports.enum(["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]).optional(),
  baseRef: external_exports.string().optional().nullable(),
  branchTemplate: external_exports.string().optional().nullable(),
  worktreeParentDir: external_exports.string().optional().nullable(),
  provisionCommand: external_exports.string().optional().nullable(),
  teardownCommand: external_exports.string().optional().nullable()
}).strict();
var issueExecutionWorkspaceSettingsSchema = external_exports.object({
  mode: external_exports.enum(["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]).optional(),
  workspaceStrategy: executionWorkspaceStrategySchema2.optional().nullable(),
  workspaceRuntime: external_exports.record(external_exports.unknown()).optional().nullable()
}).strict();
var issueAssigneeAdapterOverridesSchema = external_exports.object({
  adapterConfig: external_exports.record(external_exports.unknown()).optional(),
  useProjectWorkspace: external_exports.boolean().optional()
}).strict();
var createIssueSchema = external_exports.object({
  projectId: external_exports.string().uuid().optional().nullable(),
  projectWorkspaceId: external_exports.string().uuid().optional().nullable(),
  goalId: external_exports.string().uuid().optional().nullable(),
  parentId: external_exports.string().uuid().optional().nullable(),
  title: external_exports.string().min(1),
  description: external_exports.string().optional().nullable(),
  status: external_exports.enum(ISSUE_STATUSES).optional().default("backlog"),
  priority: external_exports.enum(ISSUE_PRIORITIES).optional().default("medium"),
  assigneeAgentId: external_exports.string().uuid().optional().nullable(),
  assigneeUserId: external_exports.string().optional().nullable(),
  requestDepth: external_exports.number().int().nonnegative().optional().default(0),
  billingCode: external_exports.string().optional().nullable(),
  assigneeAdapterOverrides: issueAssigneeAdapterOverridesSchema.optional().nullable(),
  executionWorkspaceId: external_exports.string().uuid().optional().nullable(),
  executionWorkspacePreference: external_exports.enum([
    "inherit",
    "shared_workspace",
    "isolated_workspace",
    "operator_branch",
    "reuse_existing",
    "agent_default"
  ]).optional().nullable(),
  executionWorkspaceSettings: issueExecutionWorkspaceSettingsSchema.optional().nullable(),
  labelIds: external_exports.array(external_exports.string().uuid()).optional()
});
var createIssueLabelSchema = external_exports.object({
  name: external_exports.string().trim().min(1).max(48),
  color: external_exports.string().regex(/^#(?:[0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value")
});
var updateIssueSchema = createIssueSchema.partial().extend({
  comment: external_exports.string().min(1).optional(),
  reopen: external_exports.boolean().optional(),
  hiddenAt: external_exports.string().datetime().nullable().optional()
});
var checkoutIssueSchema = external_exports.object({
  agentId: external_exports.string().uuid(),
  expectedStatuses: external_exports.array(external_exports.enum(ISSUE_STATUSES)).nonempty()
});
var addIssueCommentSchema = external_exports.object({
  body: external_exports.string().min(1),
  reopen: external_exports.boolean().optional(),
  interrupt: external_exports.boolean().optional()
});
var linkIssueApprovalSchema = external_exports.object({
  approvalId: external_exports.string().uuid()
});
var createIssueAttachmentMetadataSchema = external_exports.object({
  issueCommentId: external_exports.string().uuid().optional().nullable()
});
var ISSUE_DOCUMENT_FORMATS = ["markdown"];
var issueDocumentFormatSchema = external_exports.enum(ISSUE_DOCUMENT_FORMATS);
var issueDocumentKeySchema = external_exports.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/, "Document key must be lowercase letters, numbers, _ or -");
var upsertIssueDocumentSchema = external_exports.object({
  title: external_exports.string().trim().max(200).nullable().optional(),
  format: issueDocumentFormatSchema,
  body: external_exports.string().max(524288),
  changeSummary: external_exports.string().trim().max(500).nullable().optional(),
  baseRevisionId: external_exports.string().uuid().nullable().optional()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/work-product.js
var issueWorkProductTypeSchema = external_exports.enum([
  "preview_url",
  "runtime_service",
  "pull_request",
  "branch",
  "commit",
  "artifact",
  "document"
]);
var issueWorkProductStatusSchema = external_exports.enum([
  "active",
  "ready_for_review",
  "approved",
  "changes_requested",
  "merged",
  "closed",
  "failed",
  "archived",
  "draft"
]);
var issueWorkProductReviewStateSchema = external_exports.enum([
  "none",
  "needs_board_review",
  "approved",
  "changes_requested"
]);
var createIssueWorkProductSchema = external_exports.object({
  projectId: external_exports.string().uuid().optional().nullable(),
  executionWorkspaceId: external_exports.string().uuid().optional().nullable(),
  runtimeServiceId: external_exports.string().uuid().optional().nullable(),
  type: issueWorkProductTypeSchema,
  provider: external_exports.string().min(1),
  externalId: external_exports.string().optional().nullable(),
  title: external_exports.string().min(1),
  url: external_exports.string().url().optional().nullable(),
  status: issueWorkProductStatusSchema.default("active"),
  reviewState: issueWorkProductReviewStateSchema.optional().default("none"),
  isPrimary: external_exports.boolean().optional().default(false),
  healthStatus: external_exports.enum(["unknown", "healthy", "unhealthy"]).optional().default("unknown"),
  summary: external_exports.string().optional().nullable(),
  metadata: external_exports.record(external_exports.unknown()).optional().nullable(),
  createdByRunId: external_exports.string().uuid().optional().nullable()
});
var updateIssueWorkProductSchema = createIssueWorkProductSchema.partial();

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/execution-workspace.js
var executionWorkspaceStatusSchema = external_exports.enum([
  "active",
  "idle",
  "in_review",
  "archived",
  "cleanup_failed"
]);
var updateExecutionWorkspaceSchema = external_exports.object({
  status: executionWorkspaceStatusSchema.optional(),
  cleanupEligibleAt: external_exports.string().datetime().optional().nullable(),
  cleanupReason: external_exports.string().optional().nullable(),
  metadata: external_exports.record(external_exports.unknown()).optional().nullable()
}).strict();

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/goal.js
var createGoalSchema = external_exports.object({
  title: external_exports.string().min(1),
  description: external_exports.string().optional().nullable(),
  level: external_exports.enum(GOAL_LEVELS).optional().default("task"),
  status: external_exports.enum(GOAL_STATUSES).optional().default("planned"),
  parentId: external_exports.string().uuid().optional().nullable(),
  ownerAgentId: external_exports.string().uuid().optional().nullable()
});
var updateGoalSchema = createGoalSchema.partial();

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/approval.js
var createApprovalSchema = external_exports.object({
  type: external_exports.enum(APPROVAL_TYPES),
  requestedByAgentId: external_exports.string().uuid().optional().nullable(),
  payload: external_exports.record(external_exports.unknown()),
  issueIds: external_exports.array(external_exports.string().uuid()).optional()
});
var resolveApprovalSchema = external_exports.object({
  decisionNote: external_exports.string().optional().nullable(),
  decidedByUserId: external_exports.string().optional().default("board")
});
var requestApprovalRevisionSchema = external_exports.object({
  decisionNote: external_exports.string().optional().nullable(),
  decidedByUserId: external_exports.string().optional().default("board")
});
var resubmitApprovalSchema = external_exports.object({
  payload: external_exports.record(external_exports.unknown()).optional()
});
var addApprovalCommentSchema = external_exports.object({
  body: external_exports.string().min(1)
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/routine.js
var createRoutineSchema = external_exports.object({
  projectId: external_exports.string().uuid(),
  goalId: external_exports.string().uuid().optional().nullable(),
  parentIssueId: external_exports.string().uuid().optional().nullable(),
  title: external_exports.string().trim().min(1).max(200),
  description: external_exports.string().optional().nullable(),
  assigneeAgentId: external_exports.string().uuid(),
  priority: external_exports.enum(ISSUE_PRIORITIES).optional().default("medium"),
  status: external_exports.enum(ROUTINE_STATUSES).optional().default("active"),
  concurrencyPolicy: external_exports.enum(ROUTINE_CONCURRENCY_POLICIES).optional().default("coalesce_if_active"),
  catchUpPolicy: external_exports.enum(ROUTINE_CATCH_UP_POLICIES).optional().default("skip_missed")
});
var updateRoutineSchema = createRoutineSchema.partial();
var baseTriggerSchema = external_exports.object({
  label: external_exports.string().trim().max(120).optional().nullable(),
  enabled: external_exports.boolean().optional().default(true)
});
var createRoutineTriggerSchema = external_exports.discriminatedUnion("kind", [
  baseTriggerSchema.extend({
    kind: external_exports.literal("schedule"),
    cronExpression: external_exports.string().trim().min(1),
    timezone: external_exports.string().trim().min(1).default("UTC")
  }),
  baseTriggerSchema.extend({
    kind: external_exports.literal("webhook"),
    signingMode: external_exports.enum(ROUTINE_TRIGGER_SIGNING_MODES).optional().default("bearer"),
    replayWindowSec: external_exports.number().int().min(30).max(86400).optional().default(300)
  }),
  baseTriggerSchema.extend({
    kind: external_exports.literal("api")
  })
]);
var updateRoutineTriggerSchema = external_exports.object({
  label: external_exports.string().trim().max(120).optional().nullable(),
  enabled: external_exports.boolean().optional(),
  cronExpression: external_exports.string().trim().min(1).optional().nullable(),
  timezone: external_exports.string().trim().min(1).optional().nullable(),
  signingMode: external_exports.enum(ROUTINE_TRIGGER_SIGNING_MODES).optional().nullable(),
  replayWindowSec: external_exports.number().int().min(30).max(86400).optional().nullable()
});
var runRoutineSchema = external_exports.object({
  triggerId: external_exports.string().uuid().optional().nullable(),
  payload: external_exports.record(external_exports.unknown()).optional().nullable(),
  idempotencyKey: external_exports.string().trim().max(255).optional().nullable(),
  source: external_exports.enum(["manual", "api"]).optional().default("manual")
});
var rotateRoutineTriggerSecretSchema = external_exports.object({});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/cost.js
var createCostEventSchema = external_exports.object({
  agentId: external_exports.string().uuid(),
  issueId: external_exports.string().uuid().optional().nullable(),
  projectId: external_exports.string().uuid().optional().nullable(),
  goalId: external_exports.string().uuid().optional().nullable(),
  heartbeatRunId: external_exports.string().uuid().optional().nullable(),
  billingCode: external_exports.string().optional().nullable(),
  provider: external_exports.string().min(1),
  biller: external_exports.string().min(1).optional(),
  billingType: external_exports.enum(BILLING_TYPES).optional().default("unknown"),
  model: external_exports.string().min(1),
  inputTokens: external_exports.number().int().nonnegative().optional().default(0),
  cachedInputTokens: external_exports.number().int().nonnegative().optional().default(0),
  outputTokens: external_exports.number().int().nonnegative().optional().default(0),
  costCents: external_exports.number().int().nonnegative(),
  occurredAt: external_exports.string().datetime()
}).transform((value) => ({
  ...value,
  biller: value.biller ?? value.provider
}));
var updateBudgetSchema = external_exports.object({
  budgetMonthlyCents: external_exports.number().int().nonnegative()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/finance.js
var createFinanceEventSchema = external_exports.object({
  agentId: external_exports.string().uuid().optional().nullable(),
  issueId: external_exports.string().uuid().optional().nullable(),
  projectId: external_exports.string().uuid().optional().nullable(),
  goalId: external_exports.string().uuid().optional().nullable(),
  heartbeatRunId: external_exports.string().uuid().optional().nullable(),
  costEventId: external_exports.string().uuid().optional().nullable(),
  billingCode: external_exports.string().optional().nullable(),
  description: external_exports.string().max(500).optional().nullable(),
  eventKind: external_exports.enum(FINANCE_EVENT_KINDS),
  direction: external_exports.enum(FINANCE_DIRECTIONS).optional().default("debit"),
  biller: external_exports.string().min(1),
  provider: external_exports.string().min(1).optional().nullable(),
  executionAdapterType: external_exports.enum(AGENT_ADAPTER_TYPES).optional().nullable(),
  pricingTier: external_exports.string().min(1).optional().nullable(),
  region: external_exports.string().min(1).optional().nullable(),
  model: external_exports.string().min(1).optional().nullable(),
  quantity: external_exports.number().int().nonnegative().optional().nullable(),
  unit: external_exports.enum(FINANCE_UNITS).optional().nullable(),
  amountCents: external_exports.number().int().nonnegative(),
  currency: external_exports.string().length(3).optional().default("USD"),
  estimated: external_exports.boolean().optional().default(false),
  externalInvoiceId: external_exports.string().optional().nullable(),
  metadataJson: external_exports.record(external_exports.string(), external_exports.unknown()).optional().nullable(),
  occurredAt: external_exports.string().datetime()
}).transform((value) => ({
  ...value,
  currency: value.currency.toUpperCase()
}));

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/asset.js
var createAssetImageMetadataSchema = external_exports.object({
  namespace: external_exports.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9/_-]+$/).optional()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/access.js
var createCompanyInviteSchema = external_exports.object({
  allowedJoinTypes: external_exports.enum(INVITE_JOIN_TYPES).default("both"),
  defaultsPayload: external_exports.record(external_exports.string(), external_exports.unknown()).optional().nullable(),
  agentMessage: external_exports.string().max(4e3).optional().nullable()
});
var createOpenClawInvitePromptSchema = external_exports.object({
  agentMessage: external_exports.string().max(4e3).optional().nullable()
});
var acceptInviteSchema = external_exports.object({
  requestType: external_exports.enum(JOIN_REQUEST_TYPES),
  agentName: external_exports.string().min(1).max(120).optional(),
  adapterType: external_exports.enum(AGENT_ADAPTER_TYPES).optional(),
  capabilities: external_exports.string().max(4e3).optional().nullable(),
  agentDefaultsPayload: external_exports.record(external_exports.string(), external_exports.unknown()).optional().nullable(),
  // OpenClaw join compatibility fields accepted at top level.
  responsesWebhookUrl: external_exports.string().max(4e3).optional().nullable(),
  responsesWebhookMethod: external_exports.string().max(32).optional().nullable(),
  responsesWebhookHeaders: external_exports.record(external_exports.string(), external_exports.unknown()).optional().nullable(),
  paperclipApiUrl: external_exports.string().max(4e3).optional().nullable(),
  webhookAuthHeader: external_exports.string().max(4e3).optional().nullable()
});
var listJoinRequestsQuerySchema = external_exports.object({
  status: external_exports.enum(JOIN_REQUEST_STATUSES).optional(),
  requestType: external_exports.enum(JOIN_REQUEST_TYPES).optional()
});
var claimJoinRequestApiKeySchema = external_exports.object({
  claimSecret: external_exports.string().min(16).max(256)
});
var boardCliAuthAccessLevelSchema = external_exports.enum([
  "board",
  "instance_admin_required"
]);
var createCliAuthChallengeSchema = external_exports.object({
  command: external_exports.string().min(1).max(240),
  clientName: external_exports.string().max(120).optional().nullable(),
  requestedAccess: boardCliAuthAccessLevelSchema.default("board"),
  requestedCompanyId: external_exports.string().uuid().optional().nullable()
});
var resolveCliAuthChallengeSchema = external_exports.object({
  token: external_exports.string().min(16).max(256)
});
var updateMemberPermissionsSchema = external_exports.object({
  grants: external_exports.array(external_exports.object({
    permissionKey: external_exports.enum(PERMISSION_KEYS),
    scope: external_exports.record(external_exports.string(), external_exports.unknown()).optional().nullable()
  }))
});
var updateUserCompanyAccessSchema = external_exports.object({
  companyIds: external_exports.array(external_exports.string().uuid()).default([])
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/validators/plugin.js
var jsonSchemaSchema = external_exports.record(external_exports.unknown()).refine((val) => {
  if (Object.keys(val).length === 0)
    return true;
  return typeof val.type === "string" || val.$ref !== void 0 || val.oneOf !== void 0 || val.anyOf !== void 0 || val.allOf !== void 0;
}, { message: "Must be a valid JSON Schema object (requires at least a 'type', '$ref', or composition keyword)" });
var CRON_FIELD_PATTERN = /^(\*(?:\/[0-9]+)?|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?)(?:,(\*(?:\/[0-9]+)?|[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?))*$/;
function isValidCronExpression(expression) {
  const trimmed = expression.trim();
  if (!trimmed)
    return false;
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5)
    return false;
  return fields.every((f) => CRON_FIELD_PATTERN.test(f));
}
var pluginJobDeclarationSchema = external_exports.object({
  jobKey: external_exports.string().min(1),
  displayName: external_exports.string().min(1),
  description: external_exports.string().optional(),
  schedule: external_exports.string().refine((val) => isValidCronExpression(val), { message: "schedule must be a valid 5-field cron expression (e.g. '*/15 * * * *')" }).optional()
});
var pluginWebhookDeclarationSchema = external_exports.object({
  endpointKey: external_exports.string().min(1),
  displayName: external_exports.string().min(1),
  description: external_exports.string().optional()
});
var pluginToolDeclarationSchema = external_exports.object({
  name: external_exports.string().min(1),
  displayName: external_exports.string().min(1),
  description: external_exports.string().min(1),
  parametersSchema: jsonSchemaSchema
});
var pluginUiSlotDeclarationSchema = external_exports.object({
  type: external_exports.enum(PLUGIN_UI_SLOT_TYPES),
  id: external_exports.string().min(1),
  displayName: external_exports.string().min(1),
  exportName: external_exports.string().min(1),
  entityTypes: external_exports.array(external_exports.enum(PLUGIN_UI_SLOT_ENTITY_TYPES)).optional(),
  routePath: external_exports.string().regex(/^[a-z0-9][a-z0-9-]*$/, {
    message: "routePath must be a lowercase single-segment slug (letters, numbers, hyphens)"
  }).optional(),
  order: external_exports.number().int().optional()
}).superRefine((value, ctx) => {
  const entityScopedTypes = ["detailTab", "taskDetailView", "contextMenuItem", "commentAnnotation", "commentContextMenuItem", "projectSidebarItem"];
  if (entityScopedTypes.includes(value.type) && (!value.entityTypes || value.entityTypes.length === 0)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: `${value.type} slots require at least one entityType`,
      path: ["entityTypes"]
    });
  }
  if (value.type === "projectSidebarItem" && value.entityTypes && !value.entityTypes.includes("project")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'projectSidebarItem slots require entityTypes to include "project"',
      path: ["entityTypes"]
    });
  }
  if (value.type === "commentAnnotation" && value.entityTypes && !value.entityTypes.includes("comment")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'commentAnnotation slots require entityTypes to include "comment"',
      path: ["entityTypes"]
    });
  }
  if (value.type === "commentContextMenuItem" && value.entityTypes && !value.entityTypes.includes("comment")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'commentContextMenuItem slots require entityTypes to include "comment"',
      path: ["entityTypes"]
    });
  }
  if (value.routePath && value.type !== "page") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "routePath is only supported for page slots",
      path: ["routePath"]
    });
  }
  if (value.routePath && PLUGIN_RESERVED_COMPANY_ROUTE_SEGMENTS.includes(value.routePath)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: `routePath "${value.routePath}" is reserved by the host`,
      path: ["routePath"]
    });
  }
});
var entityScopedLauncherPlacementZones = [
  "detailTab",
  "taskDetailView",
  "contextMenuItem",
  "commentAnnotation",
  "commentContextMenuItem",
  "projectSidebarItem"
];
var launcherBoundsByEnvironment = {
  hostInline: ["inline", "compact", "default"],
  hostOverlay: ["compact", "default", "wide", "full"],
  hostRoute: ["default", "wide", "full"],
  external: [],
  iframe: ["compact", "default", "wide", "full"]
};
var pluginLauncherActionDeclarationSchema = external_exports.object({
  type: external_exports.enum(PLUGIN_LAUNCHER_ACTIONS),
  target: external_exports.string().min(1),
  params: external_exports.record(external_exports.unknown()).optional()
}).superRefine((value, ctx) => {
  if (value.type === "performAction" && value.target.includes("/")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "performAction launchers must target an action key, not a route or URL",
      path: ["target"]
    });
  }
  if (value.type === "navigate" && /^https?:\/\//.test(value.target)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "navigate launchers must target a host route, not an absolute URL",
      path: ["target"]
    });
  }
});
var pluginLauncherRenderDeclarationSchema = external_exports.object({
  environment: external_exports.enum(PLUGIN_LAUNCHER_RENDER_ENVIRONMENTS),
  bounds: external_exports.enum(PLUGIN_LAUNCHER_BOUNDS).optional()
}).superRefine((value, ctx) => {
  if (!value.bounds) {
    return;
  }
  const supportedBounds = launcherBoundsByEnvironment[value.environment];
  if (!supportedBounds.includes(value.bounds)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: `bounds "${value.bounds}" is not supported for render environment "${value.environment}"`,
      path: ["bounds"]
    });
  }
});
var pluginLauncherDeclarationSchema = external_exports.object({
  id: external_exports.string().min(1),
  displayName: external_exports.string().min(1),
  description: external_exports.string().optional(),
  placementZone: external_exports.enum(PLUGIN_LAUNCHER_PLACEMENT_ZONES),
  exportName: external_exports.string().min(1).optional(),
  entityTypes: external_exports.array(external_exports.enum(PLUGIN_UI_SLOT_ENTITY_TYPES)).optional(),
  order: external_exports.number().int().optional(),
  action: pluginLauncherActionDeclarationSchema,
  render: pluginLauncherRenderDeclarationSchema.optional()
}).superRefine((value, ctx) => {
  if (entityScopedLauncherPlacementZones.some((zone) => zone === value.placementZone) && (!value.entityTypes || value.entityTypes.length === 0)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: `${value.placementZone} launchers require at least one entityType`,
      path: ["entityTypes"]
    });
  }
  if (value.placementZone === "projectSidebarItem" && value.entityTypes && !value.entityTypes.includes("project")) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: 'projectSidebarItem launchers require entityTypes to include "project"',
      path: ["entityTypes"]
    });
  }
  if (value.action.type === "performAction" && value.render) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "performAction launchers cannot declare render hints",
      path: ["render"]
    });
  }
  if (["openModal", "openDrawer", "openPopover"].includes(value.action.type) && !value.render) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: `${value.action.type} launchers require render metadata`,
      path: ["render"]
    });
  }
  if (value.action.type === "openModal" && value.render?.environment === "hostInline") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "openModal launchers cannot use the hostInline render environment",
      path: ["render", "environment"]
    });
  }
  if (value.action.type === "openDrawer" && value.render && !["hostOverlay", "iframe"].includes(value.render.environment)) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "openDrawer launchers must use hostOverlay or iframe render environments",
      path: ["render", "environment"]
    });
  }
  if (value.action.type === "openPopover" && value.render?.environment === "hostRoute") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "openPopover launchers cannot use the hostRoute render environment",
      path: ["render", "environment"]
    });
  }
});
var pluginManifestV1Schema = external_exports.object({
  id: external_exports.string().min(1).regex(/^[a-z0-9][a-z0-9._-]*$/, "Plugin id must start with a lowercase alphanumeric and contain only lowercase letters, digits, dots, hyphens, or underscores"),
  apiVersion: external_exports.literal(1),
  version: external_exports.string().min(1).regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "Version must follow semver (e.g. 1.0.0 or 1.0.0-beta.1)"),
  displayName: external_exports.string().min(1).max(100),
  description: external_exports.string().min(1).max(500),
  author: external_exports.string().min(1).max(200),
  categories: external_exports.array(external_exports.enum(PLUGIN_CATEGORIES)).min(1),
  minimumHostVersion: external_exports.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "minimumHostVersion must follow semver (e.g. 1.0.0)").optional(),
  minimumPaperclipVersion: external_exports.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/, "minimumPaperclipVersion must follow semver (e.g. 1.0.0)").optional(),
  capabilities: external_exports.array(external_exports.enum(PLUGIN_CAPABILITIES)).min(1),
  entrypoints: external_exports.object({
    worker: external_exports.string().min(1),
    ui: external_exports.string().min(1).optional()
  }),
  instanceConfigSchema: jsonSchemaSchema.optional(),
  jobs: external_exports.array(pluginJobDeclarationSchema).optional(),
  webhooks: external_exports.array(pluginWebhookDeclarationSchema).optional(),
  tools: external_exports.array(pluginToolDeclarationSchema).optional(),
  launchers: external_exports.array(pluginLauncherDeclarationSchema).optional(),
  ui: external_exports.object({
    slots: external_exports.array(pluginUiSlotDeclarationSchema).min(1).optional(),
    launchers: external_exports.array(pluginLauncherDeclarationSchema).optional()
  }).optional()
}).superRefine((manifest2, ctx) => {
  const hasUiSlots = (manifest2.ui?.slots?.length ?? 0) > 0;
  const hasUiLaunchers = (manifest2.ui?.launchers?.length ?? 0) > 0;
  if ((hasUiSlots || hasUiLaunchers) && !manifest2.entrypoints.ui) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "entrypoints.ui is required when ui.slots or ui.launchers are declared",
      path: ["entrypoints", "ui"]
    });
  }
  if (manifest2.minimumHostVersion && manifest2.minimumPaperclipVersion && manifest2.minimumHostVersion !== manifest2.minimumPaperclipVersion) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "minimumHostVersion and minimumPaperclipVersion must match when both are declared",
      path: ["minimumHostVersion"]
    });
  }
  if (manifest2.tools && manifest2.tools.length > 0) {
    if (!manifest2.capabilities.includes("agent.tools.register")) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: "Capability 'agent.tools.register' is required when tools are declared",
        path: ["capabilities"]
      });
    }
  }
  if (manifest2.jobs && manifest2.jobs.length > 0) {
    if (!manifest2.capabilities.includes("jobs.schedule")) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: "Capability 'jobs.schedule' is required when jobs are declared",
        path: ["capabilities"]
      });
    }
  }
  if (manifest2.webhooks && manifest2.webhooks.length > 0) {
    if (!manifest2.capabilities.includes("webhooks.receive")) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: "Capability 'webhooks.receive' is required when webhooks are declared",
        path: ["capabilities"]
      });
    }
  }
  if (manifest2.jobs) {
    const jobKeys = manifest2.jobs.map((j) => j.jobKey);
    const duplicates = jobKeys.filter((key, i) => jobKeys.indexOf(key) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Duplicate job keys: ${[...new Set(duplicates)].join(", ")}`,
        path: ["jobs"]
      });
    }
  }
  if (manifest2.webhooks) {
    const endpointKeys = manifest2.webhooks.map((w) => w.endpointKey);
    const duplicates = endpointKeys.filter((key, i) => endpointKeys.indexOf(key) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Duplicate webhook endpoint keys: ${[...new Set(duplicates)].join(", ")}`,
        path: ["webhooks"]
      });
    }
  }
  if (manifest2.tools) {
    const toolNames = manifest2.tools.map((t) => t.name);
    const duplicates = toolNames.filter((name, i) => toolNames.indexOf(name) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Duplicate tool names: ${[...new Set(duplicates)].join(", ")}`,
        path: ["tools"]
      });
    }
  }
  if (manifest2.ui) {
    if (manifest2.ui.slots) {
      const slotIds = manifest2.ui.slots.map((s) => s.id);
      const duplicates = slotIds.filter((id, i) => slotIds.indexOf(id) !== i);
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `Duplicate UI slot ids: ${[...new Set(duplicates)].join(", ")}`,
          path: ["ui", "slots"]
        });
      }
    }
  }
  const allLaunchers = [
    ...manifest2.launchers ?? [],
    ...manifest2.ui?.launchers ?? []
  ];
  if (allLaunchers.length > 0) {
    const launcherIds = allLaunchers.map((launcher) => launcher.id);
    const duplicates = launcherIds.filter((id, i) => launcherIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Duplicate launcher ids: ${[...new Set(duplicates)].join(", ")}`,
        path: manifest2.ui?.launchers ? ["ui", "launchers"] : ["launchers"]
      });
    }
  }
});
var installPluginSchema = external_exports.object({
  packageName: external_exports.string().min(1),
  version: external_exports.string().min(1).optional(),
  /** Set by loader for local-path installs so the worker can be resolved. */
  packagePath: external_exports.string().min(1).optional()
});
var upsertPluginConfigSchema = external_exports.object({
  configJson: external_exports.record(external_exports.unknown())
});
var patchPluginConfigSchema = external_exports.object({
  configJson: external_exports.record(external_exports.unknown())
});
var updatePluginStatusSchema = external_exports.object({
  status: external_exports.enum(PLUGIN_STATUSES),
  lastError: external_exports.string().nullable().optional()
});
var uninstallPluginSchema = external_exports.object({
  removeData: external_exports.boolean().optional().default(false)
});
var pluginStateScopeKeySchema = external_exports.object({
  scopeKind: external_exports.enum(PLUGIN_STATE_SCOPE_KINDS),
  scopeId: external_exports.string().min(1).optional(),
  namespace: external_exports.string().min(1).optional(),
  stateKey: external_exports.string().min(1)
});
var setPluginStateSchema = external_exports.object({
  scopeKind: external_exports.enum(PLUGIN_STATE_SCOPE_KINDS),
  scopeId: external_exports.string().min(1).optional(),
  namespace: external_exports.string().min(1).optional(),
  stateKey: external_exports.string().min(1),
  /** JSON-serializable value to store. */
  value: external_exports.unknown()
});
var listPluginStateSchema = external_exports.object({
  scopeKind: external_exports.enum(PLUGIN_STATE_SCOPE_KINDS).optional(),
  scopeId: external_exports.string().min(1).optional(),
  namespace: external_exports.string().min(1).optional()
});

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/api.js
var API_PREFIX = "/api";
var API = {
  health: `${API_PREFIX}/health`,
  companies: `${API_PREFIX}/companies`,
  agents: `${API_PREFIX}/agents`,
  projects: `${API_PREFIX}/projects`,
  issues: `${API_PREFIX}/issues`,
  goals: `${API_PREFIX}/goals`,
  approvals: `${API_PREFIX}/approvals`,
  secrets: `${API_PREFIX}/secrets`,
  costs: `${API_PREFIX}/costs`,
  activity: `${API_PREFIX}/activity`,
  dashboard: `${API_PREFIX}/dashboard`,
  sidebarBadges: `${API_PREFIX}/sidebar-badges`,
  invites: `${API_PREFIX}/invites`,
  joinRequests: `${API_PREFIX}/join-requests`,
  members: `${API_PREFIX}/members`,
  admin: `${API_PREFIX}/admin`
};

// ../../node_modules/.pnpm/@paperclipai+shared@2026.325.0/node_modules/@paperclipai/shared/dist/config-schema.js
var configMetaSchema = external_exports.object({
  version: external_exports.literal(1),
  updatedAt: external_exports.string(),
  source: external_exports.enum(["onboard", "configure", "doctor"])
});
var llmConfigSchema = external_exports.object({
  provider: external_exports.enum(["claude", "openai"]),
  apiKey: external_exports.string().optional()
});
var databaseBackupConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true),
  intervalMinutes: external_exports.number().int().min(1).max(7 * 24 * 60).default(60),
  retentionDays: external_exports.number().int().min(1).max(3650).default(30),
  dir: external_exports.string().default("~/.paperclip/instances/default/data/backups")
});
var databaseConfigSchema = external_exports.object({
  mode: external_exports.enum(["embedded-postgres", "postgres"]).default("embedded-postgres"),
  connectionString: external_exports.string().optional(),
  embeddedPostgresDataDir: external_exports.string().default("~/.paperclip/instances/default/db"),
  embeddedPostgresPort: external_exports.number().int().min(1).max(65535).default(54329),
  backup: databaseBackupConfigSchema.default({
    enabled: true,
    intervalMinutes: 60,
    retentionDays: 30,
    dir: "~/.paperclip/instances/default/data/backups"
  })
});
var loggingConfigSchema = external_exports.object({
  mode: external_exports.enum(["file", "cloud"]),
  logDir: external_exports.string().default("~/.paperclip/instances/default/logs")
});
var serverConfigSchema = external_exports.object({
  deploymentMode: external_exports.enum(DEPLOYMENT_MODES).default("local_trusted"),
  exposure: external_exports.enum(DEPLOYMENT_EXPOSURES).default("private"),
  host: external_exports.string().default("127.0.0.1"),
  port: external_exports.number().int().min(1).max(65535).default(3100),
  allowedHostnames: external_exports.array(external_exports.string().min(1)).default([]),
  serveUi: external_exports.boolean().default(true)
});
var authConfigSchema = external_exports.object({
  baseUrlMode: external_exports.enum(AUTH_BASE_URL_MODES).default("auto"),
  publicBaseUrl: external_exports.string().url().optional(),
  disableSignUp: external_exports.boolean().default(false)
});
var storageLocalDiskConfigSchema = external_exports.object({
  baseDir: external_exports.string().default("~/.paperclip/instances/default/data/storage")
});
var storageS3ConfigSchema = external_exports.object({
  bucket: external_exports.string().min(1).default("paperclip"),
  region: external_exports.string().min(1).default("us-east-1"),
  endpoint: external_exports.string().optional(),
  prefix: external_exports.string().default(""),
  forcePathStyle: external_exports.boolean().default(false)
});
var storageConfigSchema = external_exports.object({
  provider: external_exports.enum(STORAGE_PROVIDERS).default("local_disk"),
  localDisk: storageLocalDiskConfigSchema.default({
    baseDir: "~/.paperclip/instances/default/data/storage"
  }),
  s3: storageS3ConfigSchema.default({
    bucket: "paperclip",
    region: "us-east-1",
    prefix: "",
    forcePathStyle: false
  })
});
var secretsLocalEncryptedConfigSchema = external_exports.object({
  keyFilePath: external_exports.string().default("~/.paperclip/instances/default/secrets/master.key")
});
var secretsConfigSchema = external_exports.object({
  provider: external_exports.enum(SECRET_PROVIDERS).default("local_encrypted"),
  strictMode: external_exports.boolean().default(false),
  localEncrypted: secretsLocalEncryptedConfigSchema.default({
    keyFilePath: "~/.paperclip/instances/default/secrets/master.key"
  })
});
var paperclipConfigSchema = external_exports.object({
  $meta: configMetaSchema,
  llm: llmConfigSchema.optional(),
  database: databaseConfigSchema,
  logging: loggingConfigSchema,
  server: serverConfigSchema,
  auth: authConfigSchema.default({
    baseUrlMode: "auto",
    disableSignUp: false
  }),
  storage: storageConfigSchema.default({
    provider: "local_disk",
    localDisk: {
      baseDir: "~/.paperclip/instances/default/data/storage"
    },
    s3: {
      bucket: "paperclip",
      region: "us-east-1",
      prefix: "",
      forcePathStyle: false
    }
  }),
  secrets: secretsConfigSchema.default({
    provider: "local_encrypted",
    strictMode: false,
    localEncrypted: {
      keyFilePath: "~/.paperclip/instances/default/secrets/master.key"
    }
  })
}).superRefine((value, ctx) => {
  if (value.server.deploymentMode === "local_trusted") {
    if (value.server.exposure !== "private") {
      ctx.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: "server.exposure must be private when deploymentMode is local_trusted",
        path: ["server", "exposure"]
      });
    }
    return;
  }
  if (value.auth.baseUrlMode === "explicit" && !value.auth.publicBaseUrl) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "auth.publicBaseUrl is required when auth.baseUrlMode is explicit",
      path: ["auth", "publicBaseUrl"]
    });
  }
  if (value.server.exposure === "public" && value.auth.baseUrlMode !== "explicit") {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "auth.baseUrlMode must be explicit when deploymentMode=authenticated and exposure=public",
      path: ["auth", "baseUrlMode"]
    });
  }
  if (value.server.exposure === "public" && !value.auth.publicBaseUrl) {
    ctx.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "auth.publicBaseUrl is required when deploymentMode=authenticated and exposure=public",
      path: ["auth", "publicBaseUrl"]
    });
  }
});

// src/constants.ts
var PLUGIN_VERSION = "0.1.2";
var STATE_NAMESPACE = "honcho";
var DEFAULT_WORKSPACE_PREFIX = "paperclip";
var HONCHO_V3_PATH = "/v3";
var HONCHO_CONNECTION_PROBE_PATH = `${HONCHO_V3_PATH}/workspaces`;
var DEFAULT_CONTEXT_SUMMARY_LIMIT = 3;
var DEFAULT_CONTEXT_TOKEN_LIMIT = 2e3;
var DEFAULT_SEARCH_LIMIT = 5;
var DEFAULT_MAX_INGEST_MESSAGE_CHARS = 2e3;
var DEFAULT_DOCUMENT_SECTION_SIZE = 1800;
var DEFAULT_DOCUMENT_SECTION_OVERLAP = 200;
var DEFAULT_BACKFILL_BATCH_SIZE = 100;
var DEFAULT_MAX_WORKSPACE_FILE_BYTES = 64 * 1024;
var DEFAULT_MIN_IMPORT_TEXT_LENGTH = 12;
var DEFAULT_NOISE_PATTERNS = [
  "^HEARTBEAT_OK$",
  "^\\[paperclip\\]\\s+starting run$",
  "^\\[paperclip\\]\\s+run started$",
  "^\\[paperclip\\]\\s+session resumed$",
  "^run started$",
  "^run finished$",
  "^startup banner:?$"
];
var SLOT_IDS = {
  settingsPage: "honcho-settings-page",
  issueTab: "honcho-issue-memory-tab"
};
var EXPORT_NAMES = {
  settingsPage: "HonchoSettingsPage",
  issueTab: "HonchoIssueMemoryTab",
  toolbarButton: "HonchoMemoryToolbarLauncher"
};
var DATA_KEYS = {
  memoryStatus: "memory-status",
  migrationPreview: "migration-preview",
  migrationJobStatus: "migration-job-status",
  issueStatus: "issue-memory-status"
};
var ACTION_KEYS = {
  testConnection: "test-connection",
  probePromptContext: "probe-prompt-context",
  resyncIssue: "resync-issue"
};
var JOB_KEYS = {
  initializeMemory: "initialize-memory",
  migrationScan: "migration-scan",
  migrationImport: "migration-import"
};
var TOOL_NAMES = {
  getIssueContext: "honcho_get_issue_context",
  searchMemory: "honcho_search_memory",
  askPeer: "honcho_ask_peer",
  getWorkspaceContext: "honcho_get_workspace_context",
  searchMessages: "honcho_search_messages",
  searchConclusions: "honcho_search_conclusions",
  getSession: "honcho_get_session",
  getAgentContext: "honcho_get_agent_context",
  getHierarchyContext: "honcho_get_hierarchy_context"
};
var ENTITY_TYPES = {
  workspaceMapping: "honcho-workspace-mapping",
  peerMapping: "honcho-peer-mapping",
  sessionMapping: "honcho-session-mapping",
  importLedger: "honcho-import-ledger",
  migrationReport: "honcho-migration-report",
  agentLineage: "honcho-agent-lineage",
  fileImportSource: "honcho-file-import-source",
  runtimeFlushCheckpoint: "honcho-runtime-flush-checkpoint"
};
var RUNTIME_LAUNCHERS = [
  {
    id: "honcho-memory-launcher",
    displayName: "Honcho Memory",
    placementZone: "globalToolbarButton",
    action: {
      type: "openDrawer",
      target: EXPORT_NAMES.toolbarButton
    },
    render: {
      environment: "hostOverlay"
    }
  }
];
var DEFAULT_CONFIG = {
  honchoApiBaseUrl: "https://api.honcho.dev",
  honchoApiKey: "",
  workspacePrefix: DEFAULT_WORKSPACE_PREFIX,
  syncIssueComments: true,
  syncIssueDocuments: true,
  enablePromptContext: false,
  enablePeerChat: true,
  observe_me: true,
  observe_others: true,
  noisePatterns: [],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false
};
var ISSUE_STATUS_STATE_KEY = "issue-sync-status";
var COMPANY_STATUS_STATE_KEY = "company-memory-status";
var COMPANY_CHECKPOINT_STATE_KEY = "company-memory-checkpoints";

// src/manifest.ts
var PLUGIN_ID = "honcho-ai.paperclip-honcho";
var manifest = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Honcho Memory",
  description: "Tool-first Honcho memory integration for Paperclip companies, agents, issues, comments, and documents.",
  author: "Honcho AI",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "companies.read",
    "projects.read",
    "project.workspaces.read",
    "issues.read",
    "issue.comments.read",
    "issue.documents.read",
    "agents.read",
    "plugin.state.read",
    "plugin.state.write",
    "events.subscribe",
    "jobs.schedule",
    "agent.tools.register",
    "http.outbound",
    "secrets.read-ref",
    "instance.settings.register",
    "ui.detailTab.register",
    "ui.action.register"
  ],
  instanceConfigSchema: {
    type: "object",
    properties: {
      honchoApiBaseUrl: {
        type: "string",
        title: "Honcho API Base URL",
        default: DEFAULT_CONFIG.honchoApiBaseUrl
      },
      honchoApiKey: {
        type: "string",
        title: "Honcho API Key",
        format: "secret-ref",
        default: DEFAULT_CONFIG.honchoApiKey
      },
      workspacePrefix: {
        type: "string",
        title: "Workspace Prefix",
        default: DEFAULT_CONFIG.workspacePrefix
      },
      syncIssueComments: {
        type: "boolean",
        title: "Sync Issue Comments",
        default: DEFAULT_CONFIG.syncIssueComments
      },
      syncIssueDocuments: {
        type: "boolean",
        title: "Sync Issue Documents",
        default: DEFAULT_CONFIG.syncIssueDocuments
      },
      enablePromptContext: {
        type: "boolean",
        title: "Inject Honcho Prompt Context",
        default: DEFAULT_CONFIG.enablePromptContext
      },
      enablePeerChat: {
        type: "boolean",
        title: "Enable Peer Chat Tool",
        default: DEFAULT_CONFIG.enablePeerChat
      },
      observe_me: {
        type: "boolean",
        title: "Observe Current Agent",
        default: DEFAULT_CONFIG.observe_me
      },
      observe_others: {
        type: "boolean",
        title: "Observe Other Participants",
        default: DEFAULT_CONFIG.observe_others
      },
      noisePatterns: {
        type: "array",
        title: "Custom Noise Patterns",
        items: { type: "string" },
        default: DEFAULT_CONFIG.noisePatterns
      },
      disableDefaultNoisePatterns: {
        type: "boolean",
        title: "Disable Default Noise Patterns",
        default: DEFAULT_CONFIG.disableDefaultNoisePatterns
      },
      stripPlatformMetadata: {
        type: "boolean",
        title: "Strip Platform Metadata",
        default: DEFAULT_CONFIG.stripPlatformMetadata
      },
      flushBeforeReset: {
        type: "boolean",
        title: "Flush Before Reset",
        default: DEFAULT_CONFIG.flushBeforeReset
      }
    }
  },
  entrypoints: {
    worker: "./dist/worker-bootstrap.js",
    ui: "./dist/ui"
  },
  jobs: [
    {
      jobKey: JOB_KEYS.initializeMemory,
      displayName: "Initialize Memory",
      description: "Connects Honcho, creates core mappings, imports baseline issue memory, and verifies manual prompt previews."
    },
    {
      jobKey: JOB_KEYS.migrationScan,
      displayName: "Scan Migration Sources",
      description: "Scans issue comments and issue documents and writes an import preview."
    },
    {
      jobKey: JOB_KEYS.migrationImport,
      displayName: "Import Historical Memory",
      description: "Imports the approved historical Paperclip issue memory preview into Honcho with idempotent ledger checks."
    }
  ],
  tools: [
    {
      name: TOOL_NAMES.getIssueContext,
      displayName: "Honcho Issue Context",
      description: "Retrieve compact Honcho context for the current issue session.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.searchMemory,
      displayName: "Honcho Search Memory",
      description: "Search Honcho memory within the current workspace, narrowing to the current issue by default.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          scope: { type: "string", enum: ["workspace", "session"] },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.askPeer,
      displayName: "Honcho Ask Peer",
      description: "Query Honcho peer chat for a target peer. Requires peer chat to be enabled in plugin config.",
      parametersSchema: {
        type: "object",
        properties: {
          targetPeerId: { type: "string" },
          query: { type: "string" },
          issueId: { type: "string" }
        },
        required: ["targetPeerId", "query"]
      }
    },
    {
      name: TOOL_NAMES.getWorkspaceContext,
      displayName: "Honcho Workspace Context",
      description: "Retrieve broad workspace recall from Honcho.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.searchMessages,
      displayName: "Honcho Search Messages",
      description: "Search raw Honcho messages.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.searchConclusions,
      displayName: "Honcho Search Conclusions",
      description: "Search high-signal summarized Honcho memory.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          issueId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: TOOL_NAMES.getSession,
      displayName: "Honcho Session",
      description: "Retrieve issue session context from Honcho.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" }
        }
      }
    },
    {
      name: TOOL_NAMES.getAgentContext,
      displayName: "Honcho Agent Context",
      description: "Retrieve peer context for a specific agent.",
      parametersSchema: {
        type: "object",
        properties: {
          agentId: { type: "string" },
          issueId: { type: "string" }
        },
        required: ["agentId"]
      }
    },
    {
      name: TOOL_NAMES.getHierarchyContext,
      displayName: "Honcho Hierarchy Context",
      description: "Retrieve delegated work context when the host provides lineage metadata.",
      parametersSchema: {
        type: "object",
        properties: {
          runId: { type: "string" },
          issueId: { type: "string" }
        }
      }
    }
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Honcho Settings",
        exportName: EXPORT_NAMES.settingsPage
      },
      {
        type: "detailTab",
        id: SLOT_IDS.issueTab,
        displayName: "Memory",
        exportName: EXPORT_NAMES.issueTab,
        entityTypes: ["issue"],
        order: 40
      }
    ],
    launchers: [
      {
        id: "honcho-memory-launcher",
        displayName: "Honcho Memory",
        placementZone: "globalToolbarButton",
        action: {
          type: "openDrawer",
          target: EXPORT_NAMES.toolbarButton
        },
        render: {
          environment: "hostOverlay"
        }
      }
    ]
  }
};
var manifest_default = manifest;

// src/deployment.ts
function normalizeBaseUrlForComparison(baseUrl) {
  const trimmed = baseUrl.trim();
  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}
function isHonchoCloudBaseUrl(baseUrl) {
  return normalizeBaseUrlForComparison(baseUrl) === normalizeBaseUrlForComparison(DEFAULT_CONFIG.honchoApiBaseUrl);
}

// src/config.ts
function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter((item) => item.length > 0);
}
function normalizeConfiguredBaseUrl(value) {
  if (typeof value !== "string") return DEFAULT_CONFIG.honchoApiBaseUrl;
  return value.trim();
}
function resolveConfig(config) {
  const input = config ?? {};
  const legacyObserveAgentPeers = normalizeBoolean(input.observeAgentPeers, DEFAULT_CONFIG.observe_me);
  return {
    honchoApiBaseUrl: normalizeConfiguredBaseUrl(input.honchoApiBaseUrl),
    honchoApiKey: normalizeString(
      input.honchoApiKey,
      normalizeString(input.honchoApiKeySecretRef, DEFAULT_CONFIG.honchoApiKey)
    ),
    workspacePrefix: normalizeString(input.workspacePrefix, DEFAULT_CONFIG.workspacePrefix) || DEFAULT_CONFIG.workspacePrefix,
    syncIssueComments: normalizeBoolean(input.syncIssueComments, DEFAULT_CONFIG.syncIssueComments),
    syncIssueDocuments: normalizeBoolean(input.syncIssueDocuments, DEFAULT_CONFIG.syncIssueDocuments),
    enablePromptContext: normalizeBoolean(input.enablePromptContext, DEFAULT_CONFIG.enablePromptContext),
    enablePeerChat: normalizeBoolean(input.enablePeerChat, DEFAULT_CONFIG.enablePeerChat),
    observe_me: typeof input.observe_me === "boolean" ? input.observe_me : typeof input.observeMe === "boolean" ? input.observeMe : legacyObserveAgentPeers,
    observe_others: typeof input.observe_others === "boolean" ? input.observe_others : typeof input.observeOthers === "boolean" ? input.observeOthers : legacyObserveAgentPeers,
    noisePatterns: normalizeStringArray(input.noisePatterns, DEFAULT_CONFIG.noisePatterns),
    disableDefaultNoisePatterns: normalizeBoolean(input.disableDefaultNoisePatterns, DEFAULT_CONFIG.disableDefaultNoisePatterns),
    stripPlatformMetadata: normalizeBoolean(input.stripPlatformMetadata, DEFAULT_CONFIG.stripPlatformMetadata),
    flushBeforeReset: normalizeBoolean(input.flushBeforeReset, DEFAULT_CONFIG.flushBeforeReset)
  };
}
async function getResolvedConfig(ctx) {
  return resolveConfig(await ctx.config.get());
}
function validateConfig(config) {
  const resolved = resolveConfig(config);
  const errors = [];
  const warnings = [];
  if (!resolved.honchoApiBaseUrl) {
    errors.push("Honcho base URL is required");
  } else {
    try {
      const parsed = new URL(resolved.honchoApiBaseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push("Honcho base URL must use http or https");
      }
    } catch {
      errors.push("Honcho base URL must be a valid URL");
    }
  }
  if (isHonchoCloudBaseUrl(resolved.honchoApiBaseUrl) && !resolved.honchoApiKey) {
    errors.push("Honcho API key is required");
  }
  if (!resolved.syncIssueComments && !resolved.syncIssueDocuments) {
    warnings.push("Both syncIssueComments and syncIssueDocuments are disabled; the plugin will only serve connection checks and on-demand tools.");
  }
  if (resolved.enablePromptContext) {
    warnings.push("Automatic prompt injection requires a newer Paperclip host; this package currently supports manual prompt previews only.");
  }
  if (resolved.flushBeforeReset) {
    warnings.push("Flush-before-reset controls are inactive in the public-host-compatible Honcho package.");
  }
  return {
    ok: errors.length === 0,
    warnings: warnings.length > 0 ? warnings : void 0,
    errors: errors.length > 0 ? errors : void 0
  };
}
function assertConfigured(config) {
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
}

// src/ids.ts
import { createHash } from "node:crypto";
function toHonchoSafeSegment(value) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function joinHonchoId(parts) {
  return parts.map((part) => toHonchoSafeSegment(part)).filter((part) => part.length > 0).join("_");
}
function workspaceIdForCompany(companyId, workspacePrefix) {
  return joinHonchoId([workspacePrefix, companyId]);
}
function peerIdForAgent(agentId) {
  return joinHonchoId(["agent", agentId]);
}
function peerIdForUser(userId) {
  return joinHonchoId(["user", userId]);
}
function sessionIdForIssue(issueId, issueIdentifier) {
  if (typeof issueIdentifier === "string" && issueIdentifier.trim()) {
    return joinHonchoId([issueIdentifier]);
  }
  return joinHonchoId(["issue", issueId]);
}
function ownerPeerIdForCompany(companyId) {
  return joinHonchoId(["owner", "company", companyId]);
}
function systemPeerId() {
  return joinHonchoId(["system", "paperclip"]);
}
function bootstrapSessionIdForCompany(companyId) {
  return joinHonchoId(["bootstrap", "company", companyId]);
}
function bootstrapSessionIdForAgent(agentId) {
  return joinHonchoId(["bootstrap", "agent", agentId]);
}
function childSessionIdForRun(runId) {
  return joinHonchoId(["run", runId]);
}
function hashId(value) {
  return createHash("sha1").update(value).digest("hex");
}
function fileExternalId(workspaceId, relativePath) {
  return `paperclip:file:${workspaceId}:${hashId(relativePath)}`;
}
function issueEntityUrl(issue) {
  return `/issues/${issue.identifier ?? issue.id}`;
}

// src/entities.ts
async function upsertEntity(ctx, input) {
  return await ctx.entities.upsert({
    entityType: input.entityType,
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    externalId: input.externalId,
    title: input.title ?? void 0,
    status: input.status ?? void 0,
    data: input.data
  });
}
async function upsertWorkspaceMapping(ctx, company, companyId, workspacePrefix, status = "mapped", workspaceId) {
  const existing = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof existing?.data.workspaceId === "string" && existing.data.workspaceId.trim() ? existing.data.workspaceId : null;
  const mappedWorkspacePrefix = typeof existing?.data.workspacePrefix === "string" && existing.data.workspacePrefix.trim() ? existing.data.workspacePrefix : null;
  const canonicalWorkspaceId = mappedWorkspaceId ?? workspaceId ?? workspaceIdForCompany(companyId, workspacePrefix);
  const canonicalWorkspacePrefix = mappedWorkspacePrefix ?? workspacePrefix;
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.workspaceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:company:${companyId}`,
    title: company?.name ?? canonicalWorkspaceId,
    status,
    data: {
      companyId,
      companyName: company?.name ?? null,
      workspaceId: canonicalWorkspaceId,
      workspacePrefix: canonicalWorkspacePrefix,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertSessionMapping(ctx, issue, workspaceId) {
  const existing = await getSessionMappingRecord(ctx, issue.id);
  const mappedSessionId = typeof existing?.data.sessionId === "string" && existing.data.sessionId.trim() ? existing.data.sessionId : null;
  const sessionId = mappedSessionId ?? sessionIdForIssue(issue.id, issue.identifier ?? null);
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "issue",
    scopeId: issue.id,
    externalId: `paperclip:issue:${issue.id}`,
    title: issue.identifier ?? issue.title,
    status: "mapped",
    data: {
      companyId: issue.companyId,
      issueId: issue.id,
      issueIdentifier: issue.identifier ?? null,
      sessionId,
      workspaceId,
      issueTitle: issue.title,
      issueStatus: issue.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertBootstrapSessionMapping(ctx, companyId, input) {
  const sessionId = input.kind === "company" ? bootstrapSessionIdForCompany(companyId) : input.kind === "agent" && input.agentId ? bootstrapSessionIdForAgent(input.agentId) : childSessionIdForRun(input.runId ?? "unknown");
  const externalId = input.kind === "company" ? `paperclip:bootstrap:company:${companyId}` : input.kind === "agent" && input.agentId ? `paperclip:bootstrap:agent:${input.agentId}` : `paperclip:run:${input.runId}`;
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId,
    title: input.title,
    status: "mapped",
    data: {
      companyId,
      sessionId,
      workspaceId: input.workspaceId,
      title: input.title,
      kind: input.kind,
      agentId: input.agentId ?? null,
      runId: input.runId ?? null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertAgentPeerMapping(ctx, companyId, agent, status = "mapped") {
  const peerId = peerIdForAgent(agent.id);
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:agent:${agent.id}`,
    title: agent.name,
    status,
    data: {
      companyId,
      agentId: agent.id,
      peerId,
      peerType: "agent",
      name: agent.name,
      role: agent.role,
      title: agent.title,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertUserPeerMapping(ctx, companyId, userId, status = "mapped") {
  const peerId = peerIdForUser(userId);
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:user:${userId}`,
    title: userId,
    status,
    data: {
      companyId,
      userId,
      peerId,
      peerType: "user",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertOwnerPeerMapping(ctx, companyId, status = "mapped") {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:owner:${companyId}`,
    title: "Company Owner",
    status,
    data: {
      companyId,
      peerId: ownerPeerIdForCompany(companyId),
      peerType: "owner",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function upsertSystemPeerMapping(ctx, companyId, status = "mapped") {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.peerMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:system:${companyId}`,
    title: "Paperclip System",
    status,
    data: {
      companyId,
      peerId: systemPeerId(),
      peerType: "system",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function ensureActorPeerMapping(ctx, companyId, actor) {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    if (agent) {
      await upsertAgentPeerMapping(ctx, companyId, agent);
      return;
    }
  }
  if (actor.authorType === "user") {
    await upsertUserPeerMapping(ctx, companyId, actor.authorId);
  }
}
async function upsertImportLedger(ctx, companyId, input) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId: input.externalId,
    title: input.issueIdentifier ?? input.issueId,
    status: "imported",
    data: {
      ...input,
      lastSeenAt: input.importedAt
    }
  });
}
async function getImportLedgerRecord(ctx, companyId, externalId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.importLedger,
    scopeKind: "company",
    scopeId: companyId,
    externalId,
    limit: 1
  });
  return records[0] ?? null;
}
async function getWorkspaceMappingRecord(ctx, companyId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.workspaceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:company:${companyId}`,
    limit: 1
  });
  return records[0] ?? null;
}
async function getSessionMappingRecord(ctx, issueId) {
  const records = await ctx.entities.list({
    entityType: ENTITY_TYPES.sessionMapping,
    scopeKind: "issue",
    scopeId: issueId,
    externalId: `paperclip:issue:${issueId}`,
    limit: 1
  });
  return records[0] ?? null;
}
async function resolveCanonicalWorkspaceId(ctx, companyId, workspacePrefix) {
  const mapping = await getWorkspaceMappingRecord(ctx, companyId);
  const mappedWorkspaceId = typeof mapping?.data.workspaceId === "string" && mapping.data.workspaceId.trim() ? mapping.data.workspaceId : null;
  return mappedWorkspaceId ?? workspaceIdForCompany(companyId, workspacePrefix);
}
async function resolveCanonicalIssueSessionId(ctx, issueId, issueIdentifier) {
  const mapping = await getSessionMappingRecord(ctx, issueId);
  const mappedSessionId = typeof mapping?.data.sessionId === "string" && mapping.data.sessionId.trim() ? mapping.data.sessionId : null;
  return mappedSessionId ?? sessionIdForIssue(issueId, issueIdentifier);
}
async function upsertMigrationReport(ctx, companyId, reportType, payload) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.migrationReport,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `paperclip:${reportType}:${companyId}`,
    title: `${reportType}:${companyId}`,
    status: "ready",
    data: payload
  });
}
async function upsertFileImportSource(ctx, companyId, input) {
  return await upsertEntity(ctx, {
    entityType: ENTITY_TYPES.fileImportSource,
    scopeKind: "company",
    scopeId: companyId,
    externalId: `${input.workspaceId}:${input.relativePath}`,
    title: input.relativePath,
    status: "ready",
    data: {
      companyId,
      ...input,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
}
async function listMappingCounts(ctx, companyId) {
  const [peers, sessions, ledger] = await Promise.all([
    ctx.entities.list({
      entityType: ENTITY_TYPES.peerMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit: 500
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.sessionMapping,
      scopeKind: "issue",
      limit: 500
    }),
    ctx.entities.list({
      entityType: ENTITY_TYPES.importLedger,
      scopeKind: "company",
      scopeId: companyId,
      limit: 1e3
    })
  ]);
  return {
    mappedPeers: peers.length,
    mappedSessions: sessions.filter((record) => record.data.companyId === companyId).length,
    importedComments: ledger.filter((record) => record.data.sourceType === "issue_comment").length,
    importedDocuments: ledger.filter((record) => record.data.sourceType === "issue_document").length,
    importedRuns: ledger.filter((record) => record.data.sourceType === "run_transcript").length,
    importedFiles: ledger.filter((record) => String(record.data.sourceType).includes("file")).length
  };
}
async function listJobsForUi(ctx) {
  return (ctx.manifest.jobs ?? []).map((job) => ({
    id: job.jobKey,
    jobKey: job.jobKey,
    displayName: job.displayName,
    status: "ready"
  }));
}
function buildMigrationReportPayload(companyId, preview) {
  return {
    companyId,
    preview,
    generatedAt: preview.generatedAt
  };
}

// src/honcho-client.ts
var RATE_LIMIT_MAX_RETRIES = 4;
var RATE_LIMIT_BASE_DELAY_MS = 250;
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
async function parseJson(res) {
  if ("json" in res) {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  return res.body ? JSON.parse(res.body) : {};
}
function isRateLimitError(status, message) {
  return status === 429 || /rate limit exceeded/i.test(message);
}
function getRetryDelayMs(res, attempt) {
  if ("headers" in res && typeof res.headers?.get === "function") {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1e3);
      }
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) {
        return Math.max(0, retryAt - Date.now());
      }
    }
  }
  return RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
}
function joinUrl(baseUrl, pathname) {
  return `${baseUrl.replace(/\/+$/, "")}${pathname}`;
}
function buildIssueContextPreview(payload) {
  const candidates = [];
  const summaryText = typeof payload.summary === "string" ? payload.summary : typeof payload.summary?.content === "string" ? payload.summary.content : null;
  if (typeof summaryText === "string" && summaryText.trim()) {
    candidates.push(summaryText.trim());
  }
  if (typeof payload.context === "string" && payload.context.trim()) {
    candidates.push(payload.context.trim());
  } else if (typeof payload.content === "string" && payload.content.trim()) {
    candidates.push(payload.content.trim());
  }
  if (candidates.length === 0 && Array.isArray(payload.messages)) {
    const messagePreview = payload.messages.map((message) => typeof message.content === "string" ? message.content.trim() : "").filter((value) => value.length > 0).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT).join("\n\n").trim();
    if (messagePreview) candidates.push(messagePreview);
  }
  return candidates[0] ?? null;
}
function buildRepresentationPreview(payload) {
  if (typeof payload.representation === "string" && payload.representation.trim()) {
    return payload.representation.trim();
  }
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    return payload.summary.trim();
  }
  if (typeof payload.content === "string" && payload.content.trim()) {
    return payload.content.trim();
  }
  if (Array.isArray(payload.results)) {
    const preview = payload.results.map((result) => typeof result.content === "string" ? result.content.trim() : "").filter(Boolean).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT).join("\n\n").trim();
    return preview || null;
  }
  return null;
}
async function requestJson(ctx, config, apiKey, pathname, init) {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const headers = {
      "content-type": "application/json"
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const res = await ctx.http.fetch(joinUrl(config.honchoApiBaseUrl, pathname), {
      ...init,
      headers: {
        ...headers,
        ...init.headers ?? {}
      }
    });
    const status = res.status;
    if (status >= 200 && status < 300) {
      return await parseJson(res);
    }
    let message = `${pathname} failed with status ${status}`;
    try {
      const payload = await parseJson(res);
      if (typeof payload.error === "string") {
        message = `${pathname} failed: ${payload.error}`;
      } else if (typeof payload.message === "string") {
        message = `${pathname} failed: ${payload.message}`;
      }
    } catch {
    }
    if (isRateLimitError(status, message) && attempt < RATE_LIMIT_MAX_RETRIES) {
      await sleep(getRetryDelayMs(res, attempt));
      continue;
    }
    throw new Error(message);
  }
  throw new Error(`${pathname} failed after exhausting retries`);
}
var HonchoClient = class {
  ctx;
  config;
  apiKey;
  ensuredWorkspaces = /* @__PURE__ */ new Set();
  ensuredSessions = /* @__PURE__ */ new Set();
  ensuredPeers = /* @__PURE__ */ new Set();
  resolvedWorkspaceIds = /* @__PURE__ */ new Map();
  resolvedSessionIds = /* @__PURE__ */ new Map();
  constructor(input) {
    this.ctx = input.ctx;
    this.config = input.config;
    this.apiKey = input.apiKey;
  }
  async workspaceId(companyId) {
    const cachedWorkspaceId = this.resolvedWorkspaceIds.get(companyId);
    if (cachedWorkspaceId) {
      return cachedWorkspaceId;
    }
    const workspaceId = await resolveCanonicalWorkspaceId(this.ctx, companyId, this.config.workspacePrefix);
    this.resolvedWorkspaceIds.set(companyId, workspaceId);
    return workspaceId;
  }
  async sessionId(companyId, issueId, issue) {
    const cacheKey = `${companyId}:${issueId}`;
    const cachedSessionId = this.resolvedSessionIds.get(cacheKey);
    if (cachedSessionId) {
      return cachedSessionId;
    }
    const resolvedIssue = issue ?? await this.ctx.issues.get(issueId, companyId);
    const sessionId = await resolveCanonicalIssueSessionId(
      this.ctx,
      issueId,
      resolvedIssue?.identifier ?? null
    );
    this.resolvedSessionIds.set(cacheKey, sessionId);
    return sessionId;
  }
  async ensureWorkspace(companyId) {
    const workspaceId = await this.workspaceId(companyId);
    if (this.ensuredWorkspaces.has(workspaceId)) {
      return workspaceId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces`, {
      method: "POST",
      body: JSON.stringify({
        id: workspaceId,
        metadata: {
          source_system: "paperclip",
          company_id: companyId
        }
      })
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }
  async ensureCompanyWorkspace(companyId, company) {
    const workspaceId = await this.workspaceId(companyId);
    if (this.ensuredWorkspaces.has(workspaceId)) {
      return workspaceId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces`, {
      method: "POST",
      body: JSON.stringify({
        id: workspaceId,
        metadata: {
          source_system: "paperclip",
          company_id: companyId,
          company_name: company?.name ?? null,
          company_issue_prefix: company?.issuePrefix ?? null
        }
      })
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }
  async probeConnection(companyId, company) {
    if (!companyId) {
      return { workspaceId: null };
    }
    const workspaceId = await this.ensureCompanyWorkspace(companyId, company ?? null);
    return { workspaceId };
  }
  async ensurePeer(companyId, peerId, metadata, peerConfig) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const cacheKey = `${workspaceId}:${peerId}`;
    if (this.ensuredPeers.has(cacheKey)) {
      return peerId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers`, {
      method: "POST",
      body: JSON.stringify({
        id: peerId,
        configuration: peerConfig,
        metadata: {
          source_system: "paperclip",
          ...metadata
        }
      })
    });
    this.ensuredPeers.add(cacheKey);
    return peerId;
  }
  async ensureAgentPeer(companyId, agent) {
    return await this.ensurePeer(
      companyId,
      peerIdForAgent(agent.id),
      {
        company_id: companyId,
        agent_id: agent.id,
        agent_name: agent.name,
        agent_role: agent.role,
        agent_title: agent.title
      },
      {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others
      }
    );
  }
  async ensureUserPeer(companyId, userId, metadata) {
    return await this.ensurePeer(
      companyId,
      peerIdForUser(userId),
      {
        company_id: companyId,
        user_id: userId,
        ...metadata
      }
    );
  }
  async ensureSession(companyId, issueId, metadata) {
    return await this.ensureRawSession(companyId, await this.sessionId(companyId, issueId), {
      source_system: "paperclip",
      company_id: companyId,
      issue_id: issueId,
      ...metadata
    });
  }
  async ensureRawSession(companyId, sessionId, metadata) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const cacheKey = `${workspaceId}:${sessionId}`;
    if (this.ensuredSessions.has(cacheKey)) {
      return sessionId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: sessionId,
        metadata
      })
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }
  async ensureIssueSession(issue, company) {
    const workspaceId = await this.ensureCompanyWorkspace(issue.companyId, company);
    const sessionId = await this.sessionId(issue.companyId, issue.id, issue);
    const cacheKey = `${workspaceId}:${sessionId}`;
    if (this.ensuredSessions.has(cacheKey)) {
      return sessionId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: sessionId,
        metadata: {
          source_system: "paperclip",
          company_id: issue.companyId,
          company_name: company?.name ?? null,
          issue_id: issue.id,
          issue_identifier: issue.identifier,
          issue_title: issue.title,
          issue_status: issue.status,
          project_id: issue.projectId,
          goal_id: issue.goalId,
          assignee_agent_id: issue.assigneeAgentId,
          assignee_user_id: issue.assigneeUserId
        }
      })
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }
  async appendMessages(companyId, issueId, messages) {
    if (messages.length === 0) return;
    const sessionId = await this.ensureSession(companyId, issueId);
    await this.appendMessagesToSession(companyId, sessionId, messages);
  }
  async appendMessagesToSession(companyId, sessionId, messages) {
    if (messages.length === 0) return;
    const workspaceId = await this.workspaceId(companyId);
    await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          messages: messages.map((message) => ({
            peer_id: message.peerId,
            content: message.content,
            created_at: message.createdAt,
            metadata: message.metadata
          }))
        })
      }
    );
  }
  async getIssueContext(companyId, issueId, userPeerId) {
    const sessionId = await this.ensureSession(companyId, issueId);
    return await this.getSessionContext(companyId, sessionId, userPeerId, issueId);
  }
  async getSessionContext(companyId, sessionId, userPeerId, issueId) {
    const workspaceId = await this.workspaceId(companyId);
    const query = new URLSearchParams({
      summary: "true",
      tokens: String(DEFAULT_CONTEXT_TOKEN_LIMIT)
    });
    if (userPeerId) {
      query.set("peer_target", userPeerId);
    }
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(sessionId)}/context?${query.toString()}`,
      {
        method: "GET"
      }
    );
    const contextPayload = payload;
    const summaryContent = typeof contextPayload.summary === "string" ? contextPayload.summary : typeof contextPayload.summary?.content === "string" ? contextPayload.summary.content : null;
    const summaries = summaryContent && summaryContent.trim() ? [{ summary: summaryContent }] : Array.isArray(contextPayload.messages) ? contextPayload.messages.reduce((items, message) => {
      if (typeof message.content === "string" && message.content.trim()) {
        items.push({ content: message.content, metadata: message.metadata ?? null });
      }
      return items;
    }, []).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT) : [];
    const preview = buildIssueContextPreview(contextPayload);
    return {
      issueId: issueId ?? sessionId,
      issueIdentifier: null,
      sessionId,
      workspaceId,
      summaries,
      context: contextPayload,
      preview
    };
  }
  async getPeerRepresentation(companyId, agentId, params) {
    const workspaceId = await this.workspaceId(companyId);
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(peerIdForAgent(agentId))}/representation`,
      {
        method: "POST",
        body: JSON.stringify({
          ...params.issueId ? { session_id: await this.sessionId(companyId, params.issueId) } : {},
          ...params.summaryOnly ? { summary_only: true } : {}
        })
      }
    );
    return buildRepresentationPreview(payload);
  }
  async searchMemory(companyId, agentId, params) {
    const agent = await this.ctx.agents.get(agentId, companyId);
    if (agent) {
      await this.ensureAgentPeer(companyId, agent);
    } else {
      await this.ensurePeer(companyId, peerIdForAgent(agentId), {
        company_id: companyId,
        agent_id: agentId
      }, {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others
      });
    }
    const workspaceId = await this.workspaceId(companyId);
    const scopedSessionId = params.scope === "workspace" ? void 0 : params.issueId ? await this.sessionId(companyId, params.issueId) : void 0;
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(peerIdForAgent(agentId))}/representation`,
      {
        method: "POST",
        body: JSON.stringify({
          session_id: scopedSessionId,
          target: scopedSessionId,
          search_query: params.query,
          search_top_k: params.limit,
          ...params.summaryOnly ? { summary_only: true } : {}
        })
      }
    );
    const data = payload;
    if (Array.isArray(data.results)) return data.results;
    if (typeof data.representation === "string" && data.representation.trim()) {
      return [{ id: "representation", content: data.representation, metadata: data.metadata ?? null, score: null }];
    }
    if (typeof data.content === "string" && data.content.trim()) {
      return [{ id: "content", content: data.content, metadata: data.metadata ?? null, score: null }];
    }
    return [];
  }
  async askPeer(companyId, agentId, params) {
    const workspaceId = await this.ensureWorkspace(companyId);
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(peerIdForAgent(agentId))}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          target: params.targetPeerId,
          query: params.query,
          session_id: params.issueId ? await this.sessionId(companyId, params.issueId) : void 0
        })
      }
    );
    return payload;
  }
  async getWorkspaceContext(companyId, agentId, query) {
    return await this.searchMemory(companyId, agentId, {
      query,
      scope: "workspace",
      limit: DEFAULT_CONTEXT_SUMMARY_LIMIT
    });
  }
};
async function createHonchoClient(input) {
  const apiKey = input.config.honchoApiKey ? await input.ctx.secrets.resolve(input.config.honchoApiKey) : null;
  return new HonchoClient({ ...input, apiKey });
}

// src/provenance.ts
function actorFromComment(comment) {
  if (comment.authorAgentId) {
    return { authorType: "agent", authorId: comment.authorAgentId };
  }
  if (comment.authorUserId) {
    return { authorType: "user", authorId: comment.authorUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}
function actorFromDocumentRevision(revision) {
  if (revision.createdByAgentId) {
    return { authorType: "agent", authorId: revision.createdByAgentId };
  }
  if (revision.createdByUserId) {
    return { authorType: "user", authorId: revision.createdByUserId };
  }
  return { authorType: "system", authorId: "paperclip" };
}
function buildCommentProvenance(issue, comment, actor) {
  return {
    sourceSystem: "paperclip",
    companyId: issue.companyId,
    issueId: issue.id,
    runId: null,
    commentId: comment.id,
    documentRevisionId: null,
    authorType: actor.authorType,
    authorId: actor.authorId,
    paperclipEntityUrl: issueEntityUrl(issue),
    paperclipIssueIdentifier: issue.identifier ?? null,
    ingestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    contentType: "issue_comment"
  };
}
function buildDocumentProvenance(issue, revision, actor) {
  return {
    sourceSystem: "paperclip",
    companyId: issue.companyId,
    issueId: issue.id,
    runId: null,
    commentId: null,
    documentRevisionId: revision.id,
    authorType: actor.authorType,
    authorId: actor.authorId,
    paperclipEntityUrl: issueEntityUrl(issue),
    paperclipIssueIdentifier: issue.identifier ?? null,
    ingestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    contentType: "issue_document_section"
  };
}
function splitDocumentIntoSections(document, revision, sectionSize, overlap) {
  const body = revision.body;
  if (!body.trim()) return [];
  const sections = [];
  let start = 0;
  let index = 0;
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(sectionSize / 2)));
  while (start < body.length) {
    const end = Math.min(body.length, start + sectionSize);
    const content = body.slice(start, end).trim();
    if (content) {
      sections.push({
        key: `${document.key}:r${revision.revisionNumber}:s${index}`,
        index,
        content
      });
    }
    if (end >= body.length) break;
    start = Math.max(end - safeOverlap, start + 1);
    index += 1;
  }
  return sections;
}

// src/state.ts
var EMPTY_ISSUE_STATUS = {
  lastSyncedCommentId: null,
  lastSyncedCommentCreatedAt: null,
  lastSyncedDocumentRevisionKey: null,
  lastSyncedDocumentRevisionId: null,
  lastSyncedRunId: null,
  lastSyncedRunFinishedAt: null,
  lastBackfillAt: null,
  replayRequestedAt: null,
  replayInProgress: false,
  lastError: null,
  latestContextPreview: null,
  latestContextFetchedAt: null,
  latestAppendAt: null,
  latestPromptContextPreview: null,
  latestPromptContextBuiltAt: null,
  latestHierarchyContextPreview: null
};
var EMPTY_COMPANY_STATUS = {
  connectionStatus: "not_configured",
  workspaceStatus: "unknown",
  peerStatus: "not_started",
  initializationStatus: "not_started",
  migrationStatus: "not_started",
  promptContextStatus: "inactive",
  lastSuccessfulSyncAt: null,
  lastError: null,
  pendingFailureCount: 0,
  lastInitializationReport: null,
  latestMigrationPreview: null
};
var EMPTY_COMPANY_CHECKPOINT = {
  activeJobKey: null,
  status: "idle",
  processed: 0,
  succeeded: 0,
  skipped: 0,
  failed: 0,
  currentSourceType: null,
  currentEntityId: null,
  lastError: null,
  updatedAt: null
};
function issueStateKey(issueId) {
  return {
    scopeKind: "issue",
    scopeId: issueId,
    namespace: STATE_NAMESPACE,
    stateKey: ISSUE_STATUS_STATE_KEY
  };
}
function companyStateKey(companyId) {
  return {
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_STATUS_STATE_KEY
  };
}
function companyCheckpointStateKey(companyId) {
  return {
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_CHECKPOINT_STATE_KEY
  };
}
async function getIssueSyncStatus(ctx, issueId) {
  const value = await ctx.state.get(issueStateKey(issueId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_ISSUE_STATUS };
  }
  return { ...EMPTY_ISSUE_STATUS, ...value };
}
async function setIssueSyncStatus(ctx, issueId, status) {
  await ctx.state.set(issueStateKey(issueId), status);
}
async function patchIssueSyncStatus(ctx, issueId, patch) {
  const next = { ...await getIssueSyncStatus(ctx, issueId), ...patch };
  await setIssueSyncStatus(ctx, issueId, next);
  return next;
}
async function clearIssueSyncStatus(ctx, issueId) {
  await ctx.state.delete(issueStateKey(issueId));
}
async function getCompanySyncStatus(ctx, companyId) {
  const value = await ctx.state.get(companyStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_STATUS };
  }
  return { ...EMPTY_COMPANY_STATUS, ...value };
}
async function patchCompanySyncStatus(ctx, companyId, patch) {
  const next = { ...await getCompanySyncStatus(ctx, companyId), ...patch };
  await ctx.state.set(companyStateKey(companyId), next);
  return next;
}
async function getCompanyCheckpoint(ctx, companyId) {
  const value = await ctx.state.get(companyCheckpointStateKey(companyId));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_COMPANY_CHECKPOINT };
  }
  return { ...EMPTY_COMPANY_CHECKPOINT, ...value };
}
async function patchCompanyCheckpoint(ctx, companyId, patch) {
  const next = { ...await getCompanyCheckpoint(ctx, companyId), ...patch };
  await ctx.state.set(companyCheckpointStateKey(companyId), next);
  return next;
}
function buildSyncErrorSummary(input) {
  return {
    at: (/* @__PURE__ */ new Date()).toISOString(),
    message: input.message,
    code: input.code ?? null,
    issueId: input.issueId ?? null,
    commentId: input.commentId ?? null,
    documentKey: input.documentKey ?? null
  };
}

// src/sync.ts
var migrationCandidatesLoaderOverride = null;
var issueSyncQueue = /* @__PURE__ */ new Map();
async function resolvePeerIdFromActor(_ctx, _companyId, actor) {
  if (actor.authorType === "agent") return peerIdForAgent(actor.authorId);
  if (actor.authorType === "user") return peerIdForUser(actor.authorId);
  return systemPeerId();
}
function compareComments(left, right) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}
function compareRevisions(left, right) {
  return left.revisionNumber - right.revisionNumber;
}
function toDocumentRevision(issueId, document) {
  return {
    id: document.latestRevisionId ?? `${document.id}:latest`,
    documentId: document.id ?? `${issueId}:${document.key}`,
    issueId,
    key: document.key,
    revisionNumber: document.latestRevisionNumber ?? 1,
    body: document.body ?? "",
    createdByAgentId: document.updatedByAgentId ?? document.createdByAgentId ?? null,
    createdByUserId: document.updatedByUserId ?? document.createdByUserId ?? null,
    createdAt: document.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    changeSummary: null
  };
}
async function listDocumentBundles(ctx, issueId, companyId) {
  const summaries = await ctx.issues.documents.list(issueId, companyId);
  const documents = await Promise.all(
    summaries.map(async (summary) => await ctx.issues.documents.get(issueId, summary.key, companyId))
  );
  return documents.flatMap((document) => {
    if (!document) return [];
    return [{
      document: {
        id: document.id,
        key: document.key,
        title: document.title ?? null,
        body: document.body,
        latestRevisionId: document.latestRevisionId ?? null,
        latestRevisionNumber: document.latestRevisionNumber ?? null,
        updatedAt: document.updatedAt,
        updatedByAgentId: document.updatedByAgentId ?? null,
        updatedByUserId: document.updatedByUserId ?? null,
        createdByAgentId: document.createdByAgentId ?? null,
        createdByUserId: document.createdByUserId ?? null
      },
      revisions: [toDocumentRevision(issueId, {
        id: document.id,
        key: document.key,
        title: document.title ?? null,
        body: document.body,
        latestRevisionId: document.latestRevisionId ?? null,
        latestRevisionNumber: document.latestRevisionNumber ?? null,
        updatedAt: document.updatedAt,
        updatedByAgentId: document.updatedByAgentId ?? null,
        updatedByUserId: document.updatedByUserId ?? null,
        createdByAgentId: document.createdByAgentId ?? null,
        createdByUserId: document.createdByUserId ?? null
      })]
    }];
  });
}
function cleanNormalizedLines(raw, config) {
  const noisePatterns = buildNoisePatterns(config);
  const seen = /* @__PURE__ */ new Set();
  const kept = [];
  for (const candidate of raw.replace(/\r\n/g, "\n").split("\n")) {
    let line = candidate.trim();
    if (!line) continue;
    if (config.stripPlatformMetadata) {
      line = line.replace(/^\[[^\]]+\]\s*/, "").trim();
      if (!line) continue;
    }
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) continue;
    if (seen.has(normalizedLine)) continue;
    if (noisePatterns.some((pattern) => pattern.test(normalizedLine))) continue;
    seen.add(normalizedLine);
    kept.push(line);
  }
  if (kept.length === 0) return null;
  const content = kept.join("\n").trim();
  const boundedContent = content.length > DEFAULT_MAX_INGEST_MESSAGE_CHARS ? `${content.slice(0, Math.max(0, DEFAULT_MAX_INGEST_MESSAGE_CHARS - 1)).trimEnd()}\u2026` : content;
  const normalized = normalizeText(boundedContent);
  if (!normalized || normalized.length < DEFAULT_MIN_IMPORT_TEXT_LENGTH) return null;
  const nonPrintable = normalized.replace(/[\x20-\x7E]/g, "");
  if (nonPrintable.length > Math.max(4, normalized.length * 0.15)) return null;
  if (noisePatterns.some((pattern) => pattern.test(normalized))) return null;
  return {
    content: boundedContent,
    fingerprint: buildFingerprint([normalized])
  };
}
async function ensureActorPeer(ctx, companyId, actor, client) {
  if (actor.authorType === "agent") {
    const agent = await ctx.agents.get(actor.authorId, companyId);
    if (agent) {
      await client.ensureAgentPeer(companyId, agent);
      await upsertAgentPeerMapping(ctx, companyId, agent);
      return;
    }
  }
  if (actor.authorType === "user") {
    await client.ensureUserPeer(companyId, actor.authorId);
    await upsertUserPeerMapping(ctx, companyId, actor.authorId);
    return;
  }
  await client.ensurePeer(companyId, systemPeerId(), {
    company_id: companyId,
    system_id: "paperclip"
  });
}
async function ensureIssueTopology(ctx, resources, client, config) {
  const workspaceId = await client.ensureCompanyWorkspace(resources.issue.companyId, resources.company);
  await upsertWorkspaceMapping(ctx, resources.company, resources.issue.companyId, config.workspacePrefix);
  await client.ensureIssueSession(resources.issue, resources.company);
  await upsertSessionMapping(ctx, resources.issue, workspaceId);
  const actorKeys = /* @__PURE__ */ new Set();
  const queueActor = (actor) => {
    if (!actor) return;
    actorKeys.add(`${actor.authorType}:${actor.authorId}`);
  };
  if (resources.issue.assigneeAgentId) {
    queueActor({ authorType: "agent", authorId: resources.issue.assigneeAgentId });
  }
  if (resources.issue.assigneeUserId) {
    queueActor({ authorType: "user", authorId: resources.issue.assigneeUserId });
  }
  if (resources.issue.createdByAgentId) {
    queueActor({ authorType: "agent", authorId: resources.issue.createdByAgentId });
  }
  if (resources.issue.createdByUserId) {
    queueActor({ authorType: "user", authorId: resources.issue.createdByUserId });
  }
  for (const comment of resources.comments) {
    queueActor(actorFromComment(comment));
  }
  for (const bundle of resources.documents) {
    for (const revision of bundle.revisions) {
      queueActor(actorFromDocumentRevision(revision));
    }
  }
  for (const key of actorKeys) {
    const [authorType, authorId] = key.split(":");
    await ensureActorPeer(
      ctx,
      resources.issue.companyId,
      {
        authorType,
        authorId
      },
      client
    );
  }
}
async function fetchIssueResources(ctx, issueId, companyId, config) {
  const [issue, company] = await Promise.all([
    ctx.issues.get(issueId, companyId),
    ctx.companies.get(companyId)
  ]);
  if (!issue) {
    throw new Error("Issue not found");
  }
  const comments = (await ctx.issues.listComments(issueId, companyId)).sort(compareComments);
  const documents = config.syncIssueDocuments ? await listDocumentBundles(ctx, issueId, companyId) : [];
  return { issue, company, comments, documents };
}
async function buildCommentMessages(ctx, issue, comments, config, replay, lastSyncedCommentId) {
  const started = replay || !lastSyncedCommentId;
  const messages = [];
  let unlocked = started;
  for (const comment of comments) {
    if (!unlocked) {
      if (comment.id === lastSyncedCommentId) {
        unlocked = true;
      }
      continue;
    }
    const normalized = normalizeAndFilterMessage(comment.body, config);
    if (!normalized) continue;
    const actor = actorFromComment(comment);
    const peerId = await resolvePeerIdFromActor(ctx, issue.companyId, actor);
    messages.push({
      content: normalized.content,
      peerId,
      createdAt: new Date(comment.createdAt).toISOString(),
      metadata: {
        ...buildCommentProvenance(issue, comment, actor),
        issueTitle: issue.title,
        issueStatus: issue.status
      }
    });
  }
  return messages;
}
async function buildDocumentMessages(ctx, issue, documents, config, lastSyncedRevisionId) {
  const messages = [];
  let unlocked = lastSyncedRevisionId == null;
  for (const bundle of documents) {
    for (const revision of bundle.revisions) {
      if (!unlocked) {
        if (revision.id === lastSyncedRevisionId) {
          unlocked = true;
        }
        continue;
      }
      const actor = actorFromDocumentRevision(revision);
      const peerId = await resolvePeerIdFromActor(ctx, issue.companyId, actor);
      for (const section of splitDocumentIntoSections(
        bundle.document,
        revision,
        DEFAULT_DOCUMENT_SECTION_SIZE,
        DEFAULT_DOCUMENT_SECTION_OVERLAP
      )) {
        const normalized = normalizeAndFilterMessage(section.content, config);
        if (!normalized) continue;
        messages.push({
          content: normalized.content,
          peerId,
          createdAt: new Date(revision.createdAt).toISOString(),
          metadata: {
            ...buildDocumentProvenance(issue, revision, actor),
            documentKey: bundle.document.key,
            documentTitle: bundle.document.title,
            revisionNumber: revision.revisionNumber,
            sectionKey: section.key,
            sectionIndex: section.index
          }
        });
      }
    }
  }
  return messages;
}
function formatSearchResults(results) {
  const lines = results.map((result, index) => {
    const content = typeof result.content === "string" ? result.content.trim() : "";
    if (!content) return null;
    return `${index + 1}. ${content}`;
  }).filter((value) => Boolean(value));
  return lines.length > 0 ? lines.join("\n") : null;
}
async function refreshContextPreview(ctx, issue, company, config, client) {
  const resolvedClient = client ?? await createHonchoClient({ ctx, config });
  await resolvedClient.ensureCompanyWorkspace(issue.companyId, company);
  await resolvedClient.ensureIssueSession(issue, company);
  const targetUserId = issue.assigneeUserId ?? issue.createdByUserId ?? null;
  const context = await resolvedClient.getIssueContext(
    issue.companyId,
    issue.id,
    targetUserId ? peerIdForUser(targetUserId) : null
  );
  await patchIssueSyncStatus(ctx, issue.id, {
    latestContextPreview: context.preview,
    latestContextFetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastError: null
  });
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null
  };
}
function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}
function buildFingerprint(parts) {
  return parts.map((part) => normalizeText(part)).join("|");
}
function buildNoisePatterns(config) {
  const patterns = [
    ...config.disableDefaultNoisePatterns ? [] : DEFAULT_NOISE_PATTERNS,
    ...config.noisePatterns
  ];
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return /^$/;
    }
  });
}
function normalizeAndFilterMessage(raw, config) {
  return cleanNormalizedLines(raw, config);
}
async function listCompanyIssues(ctx, companyId) {
  const issues = [];
  let offset = 0;
  while (true) {
    const batch = await ctx.issues.list({
      companyId,
      limit: DEFAULT_BACKFILL_BATCH_SIZE,
      offset
    });
    if (batch.length === 0) break;
    issues.push(...batch);
    offset += batch.length;
  }
  return issues;
}
async function listCompanyAgents(ctx, companyId) {
  return await ctx.agents.list({
    companyId,
    limit: DEFAULT_BACKFILL_BATCH_SIZE,
    offset: 0
  });
}
async function buildMigrationCandidates(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const issues = await listCompanyIssues(ctx, companyId);
  const candidates = [];
  for (const issue of issues) {
    const comments = (await ctx.issues.listComments(issue.id, companyId)).sort(compareComments);
    for (const comment of comments) {
      const normalized = normalizeAndFilterMessage(comment.body, config);
      if (!normalized) continue;
      const actor = actorFromComment(comment);
      candidates.push({
        sourceType: "issue_comments",
        issueId: issue.id,
        issueIdentifier: issue.identifier ?? null,
        sourceId: comment.id,
        fingerprint: buildFingerprint(["comment", comment.id, normalized.fingerprint]),
        authorType: actor.authorType,
        authorId: actor.authorId,
        createdAt: new Date(comment.createdAt).toISOString(),
        content: normalized.content,
        title: issue.identifier ?? issue.id,
        metadata: {
          ...buildCommentProvenance(issue, comment, actor),
          issueTitle: issue.title,
          issueStatus: issue.status
        }
      });
    }
    if (config.syncIssueDocuments) {
      const documents = await listDocumentBundles(ctx, issue.id, companyId);
      for (const bundle of documents) {
        for (const revision of bundle.revisions) {
          const actor = actorFromDocumentRevision(revision);
          for (const section of splitDocumentIntoSections(
            bundle.document,
            revision,
            DEFAULT_DOCUMENT_SECTION_SIZE,
            DEFAULT_DOCUMENT_SECTION_OVERLAP
          )) {
            const normalized = normalizeAndFilterMessage(section.content, config);
            if (!normalized) continue;
            candidates.push({
              sourceType: "issue_documents",
              issueId: issue.id,
              issueIdentifier: issue.identifier ?? null,
              sourceId: `${revision.id}:${section.key}`,
              fingerprint: buildFingerprint(["document", revision.id, section.key, normalized.fingerprint]),
              authorType: actor.authorType,
              authorId: actor.authorId,
              createdAt: new Date(revision.createdAt).toISOString(),
              content: normalized.content,
              title: issue.identifier ?? issue.id,
              metadata: {
                ...buildDocumentProvenance(issue, revision, actor),
                issueTitle: issue.title,
                issueStatus: issue.status,
                documentKey: bundle.document.key,
                documentTitle: bundle.document.title,
                revisionNumber: revision.revisionNumber,
                sectionKey: section.key,
                sectionIndex: section.index
              }
            });
          }
        }
      }
    }
  }
  return candidates.sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}
async function loadMigrationCandidates(ctx, companyId) {
  if (migrationCandidatesLoaderOverride) {
    return await migrationCandidatesLoaderOverride(ctx, companyId);
  }
  return await buildMigrationCandidates(ctx, companyId);
}
async function runIssueSyncExclusive(companyId, issueId, work) {
  const queueKey = `${companyId}:${issueId}`;
  const previous = issueSyncQueue.get(queueKey) ?? Promise.resolve();
  let release = () => {
  };
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  issueSyncQueue.set(queueKey, queued);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (issueSyncQueue.get(queueKey) === queued) {
      issueSyncQueue.delete(queueKey);
    }
  }
}
function buildMigrationPreview(companyId, candidates) {
  const comments = candidates.filter((candidate) => candidate.sourceType === "issue_comments");
  const documents = candidates.filter((candidate) => candidate.sourceType === "issue_documents");
  const files = candidates.filter((candidate) => !["issue_comments", "issue_documents"].includes(candidate.sourceType));
  const warnings = [];
  if (comments.length === 0) {
    warnings.push("No issue comments were found for this company.");
  }
  if (documents.length === 0) {
    warnings.push("No issue document revisions were found for this company.");
  }
  return {
    companyId,
    sourceTypes: Array.from(new Set(candidates.map((candidate) => candidate.sourceType))),
    totals: {
      comments: comments.length,
      documents: documents.length,
      files: files.length
    },
    estimatedMessages: candidates.length,
    warnings,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function patchJobProgress(ctx, companyId, patch) {
  return await patchCompanyCheckpoint(ctx, companyId, {
    ...patch,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function buildMemoryStatusData(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  const [companyStatus, counts, checkpoints, jobs] = await Promise.all([
    getCompanySyncStatus(ctx, companyId),
    listMappingCounts(ctx, companyId),
    getCompanyCheckpoint(ctx, companyId),
    Promise.resolve(listJobsForUi(ctx))
  ]);
  return {
    config,
    validation: {
      ok: validation.ok,
      warnings: validation.warnings ?? [],
      errors: validation.errors ?? []
    },
    companyId,
    companyStatus,
    counts,
    checkpoints,
    jobs
  };
}
async function ensureMigrationCandidateImported(ctx, companyId, candidate, config, client) {
  const externalId = candidate.sourceType === "issue_comments" ? `paperclip:comment:${candidate.sourceId}` : candidate.sourceType === "issue_documents" ? `paperclip:document:${candidate.sourceId}` : candidate.workspaceId && candidate.metadata.relativePath ? fileExternalId(candidate.workspaceId, String(candidate.metadata.relativePath)) : candidate.sourceId;
  const existing = await getImportLedgerRecord(ctx, companyId, externalId);
  if (existing && existing.data.fingerprint === candidate.fingerprint) {
    return { imported: false, skipped: true };
  }
  const company = await ctx.companies.get(companyId);
  const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
  await upsertWorkspaceMapping(ctx, company, companyId, config.workspacePrefix, "mapped", workspaceId);
  if (candidate.issueId) {
    const issue = await ctx.issues.get(candidate.issueId, companyId);
    if (!issue) {
      return { imported: false, skipped: true };
    }
    await client.ensureIssueSession(issue, company);
    await upsertSessionMapping(ctx, issue, workspaceId);
    const actor = {
      authorType: candidate.authorType,
      authorId: candidate.authorId
    };
    await ensureActorPeer(ctx, companyId, actor, client);
    await ensureActorPeerMapping(ctx, companyId, actor);
    await client.appendMessages(companyId, issue.id, [{
      content: candidate.content,
      peerId: await resolvePeerIdFromActor(ctx, companyId, actor),
      createdAt: candidate.createdAt,
      metadata: candidate.metadata
    }]);
    await upsertImportLedger(ctx, companyId, {
      sourceType: candidate.sourceType === "issue_comments" ? "issue_comment" : candidate.sourceType === "issue_documents" ? "issue_document" : "run_transcript",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: candidate.metadata
    });
  } else {
    const isGuidance = candidate.sourceType === "workspace_guidance_files";
    const isAgentProfile = candidate.sourceType === "agent_profile_files";
    const agentProfileId = isAgentProfile && typeof candidate.metadata.authorId === "string" ? String(candidate.metadata.authorId).replace(/^agent:/, "") : null;
    const agentProfile = agentProfileId ? await ctx.agents.get(agentProfileId, companyId) : null;
    const peerId = isGuidance ? systemPeerId() : agentProfile ? peerIdForAgent(agentProfile.id) : ownerPeerIdForCompany(companyId);
    if (isGuidance) {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        system_id: "paperclip"
      });
      await upsertSystemPeerMapping(ctx, companyId);
    } else if (agentProfile) {
      await client.ensureAgentPeer(companyId, agentProfile);
      await upsertAgentPeerMapping(ctx, companyId, agentProfile);
    } else {
      await client.ensurePeer(companyId, peerId, {
        company_id: companyId,
        owner_id: companyId
      });
      await upsertOwnerPeerMapping(ctx, companyId);
    }
    const sessionId = agentProfileId ? bootstrapSessionIdForAgent(agentProfileId) : bootstrapSessionIdForCompany(companyId);
    await client.ensureRawSession(companyId, sessionId, {
      source_system: "paperclip",
      company_id: companyId,
      session_role: isAgentProfile ? "agent_profile" : "bootstrap"
    });
    await upsertBootstrapSessionMapping(ctx, companyId, {
      kind: isAgentProfile ? "agent" : "company",
      agentId: agentProfileId ?? void 0,
      title: isGuidance ? "Workspace Guidance" : "Legacy Memory",
      workspaceId
    });
    await upsertFileImportSource(ctx, companyId, {
      workspaceId: candidate.workspaceId ?? workspaceId,
      projectId: candidate.projectId ?? "unknown",
      relativePath: String(candidate.metadata.relativePath ?? candidate.title),
      sourceCategory: String(candidate.sourceCategory ?? "legacy-user-memory")
    });
    await client.appendMessagesToSession(companyId, sessionId, [{
      content: candidate.content,
      peerId,
      createdAt: candidate.createdAt,
      metadata: candidate.metadata
    }]);
    await upsertImportLedger(ctx, companyId, {
      sourceType: isGuidance ? "workspace_guidance_file" : isAgentProfile ? "agent_profile_file" : "legacy_memory_file",
      externalId,
      fingerprint: candidate.fingerprint,
      issueId: candidate.issueId ?? sessionId,
      issueIdentifier: candidate.issueIdentifier,
      importedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: candidate.metadata
    });
  }
  return { imported: true, skipped: false };
}
async function scanMigrationSources(ctx, companyId) {
  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "scanned",
    lastError: null
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-scan",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null
  });
  try {
    const preview = buildMigrationPreview(companyId, await loadMigrationCandidates(ctx, companyId));
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "preview_ready",
      latestMigrationPreview: preview,
      lastError: null
    });
    await upsertMigrationReport(ctx, companyId, "preview", buildMigrationReportPayload(companyId, preview));
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "complete",
      processed: preview.estimatedMessages,
      succeeded: preview.estimatedMessages,
      currentSourceType: null,
      currentEntityId: null
    });
    return preview;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      migrationStatus: "failed",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-scan",
      status: "failed",
      lastError: message
    });
    throw error;
  }
}
async function importMigrationPreview(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
  const preview = (await getCompanySyncStatus(ctx, companyId)).latestMigrationPreview ?? await scanMigrationSources(ctx, companyId);
  const candidates = await loadMigrationCandidates(ctx, companyId);
  const client = await createHonchoClient({ ctx, config });
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  let firstError = null;
  await patchCompanySyncStatus(ctx, companyId, {
    migrationStatus: "running",
    lastError: null
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-import",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null
  });
  for (const candidate of candidates) {
    processed += 1;
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "migration-import",
      processed,
      succeeded,
      skipped,
      failed,
      currentSourceType: candidate.sourceType,
      currentEntityId: candidate.sourceId
    });
    try {
      const result = await ensureMigrationCandidateImported(ctx, companyId, candidate, config, client);
      if (result.imported) {
        succeeded += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      firstError ??= error instanceof Error ? error.message : String(error);
    }
  }
  const report = {
    companyId,
    preview,
    summary: {
      commentsImported: await listMappingCounts(ctx, companyId).then((counts2) => counts2.importedComments),
      documentsImported: await listMappingCounts(ctx, companyId).then((counts2) => counts2.importedDocuments),
      skipped,
      failed
    },
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await upsertMigrationReport(ctx, companyId, "import", report);
  const counts = await listMappingCounts(ctx, companyId);
  await patchCompanySyncStatus(ctx, companyId, {
    connectionStatus: "connected",
    migrationStatus: failed > 0 ? "partial" : "complete",
    lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastError: firstError ? buildSyncErrorSummary({ message: firstError }) : null,
    pendingFailureCount: failed > 0 ? (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1 : 0
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "migration-import",
    status: failed > 0 ? "failed" : "complete",
    processed,
    succeeded,
    skipped,
    failed,
    currentSourceType: null,
    currentEntityId: null,
    lastError: firstError
  });
  return counts;
}
async function initializeMemory(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const validation = validateConfig(config);
  if (!validation.ok) {
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "auth_failed",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({
        message: validation.errors?.join("; ") ?? "Honcho config is invalid"
      })
    });
    throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
  }
  const company = await ctx.companies.get(companyId);
  const client = await createHonchoClient({ ctx, config });
  await patchCompanySyncStatus(ctx, companyId, {
    connectionStatus: "connected",
    initializationStatus: "running",
    workspaceStatus: "unknown",
    peerStatus: "not_started",
    lastError: null
  });
  await patchJobProgress(ctx, companyId, {
    activeJobKey: "initialize-memory",
    status: "running",
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentSourceType: null,
    currentEntityId: null,
    lastError: null
  });
  try {
    await client.probeConnection(companyId, company);
    await repairMappings(ctx, companyId);
    const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
    const preview = await scanMigrationSources(ctx, companyId);
    const countsBefore = await listMappingCounts(ctx, companyId);
    await importMigrationPreview(ctx, companyId);
    const probe = await probePromptContext(ctx, companyId);
    const counts = await listMappingCounts(ctx, companyId);
    const report = {
      companyId,
      workspace: {
        id: workspaceId,
        status: countsBefore.mappedSessions > 0 ? "existing" : "created"
      },
      peers: {
        mapped: counts.mappedPeers,
        status: counts.mappedPeers > 0 ? "complete" : "partial"
      },
      importSummary: {
        comments: counts.importedComments,
        documents: counts.importedDocuments,
        skipped: 0,
        failed: 0
      },
      promptContext: {
        status: probe.status,
        preview: probe.preview
      },
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await upsertMigrationReport(ctx, companyId, "initialization", report);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: "connected",
      workspaceStatus: "created",
      peerStatus: counts.mappedPeers > 0 ? "complete" : "partial",
      initializationStatus: "complete",
      migrationStatus: "complete",
      promptContextStatus: probe.status,
      lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastError: null,
      pendingFailureCount: 0,
      lastInitializationReport: report
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "complete",
      processed: counts.importedComments + counts.importedDocuments,
      succeeded: counts.importedComments + counts.importedDocuments,
      skipped: 0,
      failed: 0,
      currentSourceType: null,
      currentEntityId: null,
      lastError: null
    });
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchCompanySyncStatus(ctx, companyId, {
      connectionStatus: message.includes("secret ref") ? "auth_failed" : "connected",
      initializationStatus: "failed",
      promptContextStatus: "inactive",
      pendingFailureCount: (await getCompanySyncStatus(ctx, companyId)).pendingFailureCount + 1,
      lastError: buildSyncErrorSummary({ message })
    });
    await patchJobProgress(ctx, companyId, {
      activeJobKey: "initialize-memory",
      status: "failed",
      lastError: message
    });
    throw error;
  }
}
async function syncIssue(ctx, issueId, companyId, options = {}) {
  return await runIssueSyncExclusive(companyId, issueId, async () => {
    const config = await getResolvedConfig(ctx);
    const status = await getIssueSyncStatus(ctx, issueId);
    const replay = options.replay === true;
    const resources = await fetchIssueResources(ctx, issueId, companyId, config);
    const client = await createHonchoClient({ ctx, config });
    await patchIssueSyncStatus(ctx, issueId, {
      replayInProgress: replay,
      replayRequestedAt: replay ? (/* @__PURE__ */ new Date()).toISOString() : status.replayRequestedAt
    });
    try {
      await ensureIssueTopology(ctx, resources, client, config);
      const commentMessages = config.syncIssueComments ? await buildCommentMessages(ctx, resources.issue, resources.comments, config, replay, replay ? null : status.lastSyncedCommentId) : [];
      const documentMessages = config.syncIssueDocuments ? await buildDocumentMessages(ctx, resources.issue, resources.documents, config, replay ? null : status.lastSyncedDocumentRevisionId) : [];
      const allMessages = [...commentMessages, ...documentMessages];
      if (allMessages.length > 0) {
        await client.appendMessages(resources.issue.companyId, resources.issue.id, allMessages);
      } else {
        await client.ensureIssueSession(resources.issue, resources.company);
      }
      const lastComment = resources.comments.at(-1) ?? null;
      const lastDocumentRevision = resources.documents.flatMap((bundle) => bundle.revisions).sort(compareRevisions).at(-1) ?? null;
      const context = await refreshContextPreview(ctx, resources.issue, resources.company, config, client);
      await patchIssueSyncStatus(ctx, issueId, {
        lastSyncedCommentId: lastComment?.id ?? status.lastSyncedCommentId,
        lastSyncedCommentCreatedAt: lastComment ? new Date(lastComment.createdAt).toISOString() : status.lastSyncedCommentCreatedAt,
        lastSyncedDocumentRevisionKey: lastDocumentRevision?.key ?? status.lastSyncedDocumentRevisionKey,
        lastSyncedDocumentRevisionId: lastDocumentRevision?.id ?? status.lastSyncedDocumentRevisionId,
        lastBackfillAt: (/* @__PURE__ */ new Date()).toISOString(),
        replayInProgress: false,
        lastError: null,
        latestAppendAt: allMessages.length > 0 ? (/* @__PURE__ */ new Date()).toISOString() : status.latestAppendAt,
        latestContextPreview: context.preview,
        latestContextFetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await patchCompanySyncStatus(ctx, companyId, {
        connectionStatus: "connected",
        workspaceStatus: "mapped",
        peerStatus: "partial",
        lastSuccessfulSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastError: null
      });
      return {
        issueId: resources.issue.id,
        issueIdentifier: resources.issue.identifier ?? null,
        syncedComments: commentMessages.length,
        syncedDocumentSections: documentMessages.length,
        syncedRuns: 0,
        lastSyncedCommentId: lastComment?.id ?? null,
        lastSyncedRunId: null,
        replayed: replay
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const previous = await getCompanySyncStatus(ctx, companyId);
      await patchCompanySyncStatus(ctx, companyId, {
        pendingFailureCount: previous.pendingFailureCount + 1,
        lastError: buildSyncErrorSummary({
          message,
          issueId,
          commentId: options.commentIdHint ?? null,
          documentKey: options.documentKeyHint ?? null
        })
      });
      await patchIssueSyncStatus(ctx, issueId, {
        replayInProgress: false,
        lastError: buildSyncErrorSummary({
          message,
          issueId,
          commentId: options.commentIdHint ?? null,
          documentKey: options.documentKeyHint ?? null
        })
      });
      throw error;
    }
  });
}
async function replayIssue(ctx, issueId, companyId) {
  await clearIssueSyncStatus(ctx, issueId);
  return await syncIssue(ctx, issueId, companyId, { replay: true });
}
async function loadIssueStatusData(ctx, issueId, companyId) {
  const config = await getResolvedConfig(ctx);
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) {
    throw new Error("Issue not found");
  }
  const status = await getIssueSyncStatus(ctx, issueId);
  return {
    syncEnabled: config.syncIssueComments || config.syncIssueDocuments,
    issueId,
    issueIdentifier: issue.identifier ?? null,
    lastSyncedCommentId: status.lastSyncedCommentId,
    lastSyncedCommentCreatedAt: status.lastSyncedCommentCreatedAt,
    lastSyncedDocumentRevisionKey: status.lastSyncedDocumentRevisionKey,
    lastSyncedDocumentRevisionId: status.lastSyncedDocumentRevisionId,
    lastSyncedRunId: status.lastSyncedRunId,
    lastSyncedRunFinishedAt: status.lastSyncedRunFinishedAt,
    lastBackfillAt: status.lastBackfillAt,
    replayRequestedAt: status.replayRequestedAt,
    replayInProgress: status.replayInProgress,
    lastError: status.lastError,
    contextPreview: status.latestContextPreview,
    contextFetchedAt: status.latestContextFetchedAt,
    latestAppendAt: status.latestAppendAt,
    latestPromptContextPreview: status.latestPromptContextPreview,
    latestPromptContextBuiltAt: status.latestPromptContextBuiltAt,
    config: {
      syncIssueComments: config.syncIssueComments,
      syncIssueDocuments: config.syncIssueDocuments,
      enablePromptContext: config.enablePromptContext,
      enablePeerChat: config.enablePeerChat,
      observe_me: config.observe_me,
      observe_others: config.observe_others
    }
  };
}
async function loadMemoryStatusData(ctx, companyId) {
  return await buildMemoryStatusData(ctx, companyId);
}
async function loadMigrationPreviewData(ctx, companyId) {
  const companyStatus = await getCompanySyncStatus(ctx, companyId);
  return companyStatus.latestMigrationPreview;
}
async function loadMigrationJobStatusData(ctx, companyId) {
  return {
    companyId,
    checkpoint: await getCompanyCheckpoint(ctx, companyId)
  };
}
async function probePromptContext(ctx, companyId, input) {
  const issueId = input?.issueId ?? (await listCompanyIssues(ctx, companyId))[0]?.id ?? null;
  const agentId = input?.agentId ?? (await listCompanyAgents(ctx, companyId))[0]?.id ?? null;
  if (!agentId) {
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "inactive"
    });
    return { status: "inactive", preview: null };
  }
  try {
    const result = await buildPromptContext(ctx, {
      companyId,
      issueId,
      agentId,
      runId: `probe:${companyId}:${issueId ?? "workspace"}:${agentId}`,
      prompt: input?.prompt ?? void 0
    });
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: result ? "active" : "inactive",
      lastError: null
    });
    return {
      status: result ? "active" : "inactive",
      preview: result?.preview ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const previous = await getCompanySyncStatus(ctx, companyId);
    await patchCompanySyncStatus(ctx, companyId, {
      promptContextStatus: "degraded",
      lastError: buildSyncErrorSummary({ message }),
      pendingFailureCount: previous.pendingFailureCount + 1
    });
    throw error;
  }
}
async function repairMappings(ctx, companyId) {
  const config = await getResolvedConfig(ctx);
  const company = await ctx.companies.get(companyId);
  const client = await createHonchoClient({ ctx, config });
  let repaired = 0;
  const workspaceId = await client.ensureCompanyWorkspace(companyId, company);
  await upsertWorkspaceMapping(ctx, company, companyId, config.workspacePrefix, "mapped", workspaceId);
  repaired += 1;
  const agents = await listCompanyAgents(ctx, companyId);
  for (const agent of agents) {
    await client.ensureAgentPeer(companyId, agent);
    await upsertAgentPeerMapping(ctx, companyId, agent);
    repaired += 1;
  }
  const issues = await listCompanyIssues(ctx, companyId);
  for (const issue of issues) {
    await client.ensureIssueSession(issue, company);
    await upsertSessionMapping(ctx, issue, workspaceId);
    repaired += 1;
  }
  await patchCompanySyncStatus(ctx, companyId, {
    workspaceStatus: "mapped",
    peerStatus: agents.length > 0 ? "complete" : "partial",
    lastError: null
  });
  return { repaired };
}
async function getIssueContext(ctx, issueId, companyId) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue) throw new Error("Issue not found");
  const company = await ctx.companies.get(companyId);
  const config = await getResolvedConfig(ctx);
  const context = await refreshContextPreview(ctx, issue, company, config);
  return {
    ...context,
    issueIdentifier: issue.identifier ?? null
  };
}
async function getSessionContext(ctx, issueId, companyId) {
  return await getIssueContext(ctx, issueId, companyId);
}
async function getWorkspaceContext(ctx, agentId, companyId, query) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  return await client.getWorkspaceContext(companyId, agentId, query);
}
async function getAgentContext(ctx, companyId, agentId, issueId) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  return await client.getPeerRepresentation(companyId, agentId, {
    issueId: issueId ?? null
  });
}
async function getHierarchyContext(_ctx, _companyId, _runId) {
  return null;
}
async function searchMemory(ctx, agentId, companyId, params) {
  const config = await getResolvedConfig(ctx);
  const client = await createHonchoClient({ ctx, config });
  const scope = params.scope ?? (params.issueId ? "session" : "workspace");
  return await client.searchMemory(companyId, agentId, {
    ...params,
    scope,
    limit: params.limit ?? DEFAULT_SEARCH_LIMIT
  });
}
async function buildPromptContext(ctx, input) {
  const config = await getResolvedConfig(ctx);
  if (!config.enablePromptContext) return null;
  if (!validateConfig(config).ok) return null;
  const client = await createHonchoClient({ ctx, config });
  const [company, issue, agent] = await Promise.all([
    ctx.companies.get(input.companyId),
    input.issueId ? ctx.issues.get(input.issueId, input.companyId) : Promise.resolve(null),
    ctx.agents.get(input.agentId, input.companyId)
  ]);
  if (agent) {
    await client.ensureAgentPeer(input.companyId, agent);
  }
  const query = input.prompt ?? issue?.title ?? company?.name ?? agent?.name ?? "recent company memory";
  const sections = [];
  if (issue) {
    await syncIssue(ctx, issue.id, input.companyId, { replay: false });
    const issueContext = await getIssueContext(ctx, issue.id, input.companyId);
    if (issueContext.preview) {
      sections.push(`Task session memory for ${issue.identifier ?? issue.id}:
${issueContext.preview}`);
    }
  }
  const peerRepresentation = await client.getPeerRepresentation(input.companyId, input.agentId, {
    issueId: issue?.id ?? null
  }).catch(() => null);
  if (peerRepresentation) {
    sections.push(`Active employee peer memory:
${peerRepresentation}`);
  }
  const workspaceResults = await searchMemory(ctx, input.agentId, input.companyId, {
    query,
    scope: "workspace",
    limit: 3
  }).catch(() => []);
  const workspacePreview = formatSearchResults(workspaceResults);
  if (workspacePreview) {
    sections.push(`Company workspace recall:
${workspacePreview}`);
  }
  const hierarchyPreview = await getHierarchyContext(ctx, input.companyId, input.runId).catch(() => null);
  if (hierarchyPreview) {
    sections.push(`Delegated child memory:
${hierarchyPreview}`);
    if (issue) {
      await patchIssueSyncStatus(ctx, issue.id, {
        latestHierarchyContextPreview: hierarchyPreview
      });
    }
  }
  if (sections.length === 0) return null;
  const prompt = sections.join("\n\n");
  const preview = prompt.length > 1500 ? `${prompt.slice(0, 1500)}...` : prompt;
  if (issue) {
    await patchIssueSyncStatus(ctx, issue.id, {
      latestPromptContextPreview: preview,
      latestPromptContextBuiltAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return {
    prompt,
    preview,
    metadata: {
      companyId: input.companyId,
      issueId: issue?.id ?? null,
      agentId: input.agentId
    }
  };
}

// src/worker.ts
function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}
function inferIssueId(params, runCtx) {
  if (typeof params.issueId === "string" && params.issueId.trim()) return params.issueId.trim();
  return null;
}
var plugin = definePlugin({
  async setup(ctx) {
    const initialConfig = await getResolvedConfig(ctx);
    for (const launcher of RUNTIME_LAUNCHERS) {
      ctx.launchers.register(launcher);
    }
    ctx.data.register(DATA_KEYS.memoryStatus, async (params) => {
      const companyId = typeof params.companyId === "string" && params.companyId.trim() ? params.companyId.trim() : null;
      if (!companyId) {
        throw new Error("companyId is required");
      }
      return await loadMemoryStatusData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.migrationPreview, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await loadMigrationPreviewData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.migrationJobStatus, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await loadMigrationJobStatusData(ctx, companyId);
    });
    ctx.data.register(DATA_KEYS.issueStatus, async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const companyId = requireString(params.companyId, "companyId");
      return await loadIssueStatusData(ctx, issueId, companyId);
    });
    ctx.actions.register(ACTION_KEYS.testConnection, async () => {
      const config = await getResolvedConfig(ctx);
      const validation = validateConfig(config);
      if (!validation.ok) {
        throw new Error(validation.errors?.join("; ") ?? "Honcho config is invalid");
      }
      const companyId = (await ctx.companies.list({ limit: 1, offset: 0 }))[0]?.id ?? null;
      const company = companyId ? await ctx.companies.get(companyId) : null;
      const client = await createHonchoClient({ ctx, config });
      const { workspaceId } = await client.probeConnection(companyId ?? void 0, company);
      return {
        ok: true,
        workspaceId,
        at: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
    ctx.actions.register(ACTION_KEYS.resyncIssue, async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const companyId = requireString(params.companyId, "companyId");
      return await replayIssue(ctx, issueId, companyId);
    });
    ctx.actions.register(ACTION_KEYS.probePromptContext, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await probePromptContext(ctx, companyId, {
        issueId: typeof params.issueId === "string" ? params.issueId : null,
        agentId: typeof params.agentId === "string" ? params.agentId : null,
        prompt: typeof params.prompt === "string" ? params.prompt : null
      });
    });
    ctx.jobs.register(JOB_KEYS.initializeMemory, async () => {
      const companies = await ctx.companies.list({ limit: 1, offset: 0 });
      const companyId = companies[0]?.id;
      if (!companyId) throw new Error("No company available to initialize memory");
      await initializeMemory(ctx, companyId);
    });
    ctx.jobs.register(JOB_KEYS.migrationScan, async () => {
      const companies = await ctx.companies.list({ limit: 1, offset: 0 });
      const companyId = companies[0]?.id;
      if (!companyId) throw new Error("No company available to scan migration sources");
      await scanMigrationSources(ctx, companyId);
    });
    ctx.jobs.register(JOB_KEYS.migrationImport, async () => {
      const companies = await ctx.companies.list({ limit: 1, offset: 0 });
      const companyId = companies[0]?.id;
      if (!companyId) throw new Error("No company available to import migration sources");
      await importMigrationPreview(ctx, companyId);
    });
    ctx.events.on("issue.created", async (event) => {
      try {
        if (!event.entityId) return;
        await syncIssue(ctx, event.entityId, event.companyId, { replay: false });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.created failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.events.on("issue.comment.created", async (event) => {
      try {
        if (!event.entityId) return;
        const payload = typeof event.payload === "object" && event.payload !== null ? event.payload : {};
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          commentIdHint: typeof payload.commentId === "string" ? payload.commentId : null
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.comment.created failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.events.on("issue.updated", async (event) => {
      try {
        const config = await getResolvedConfig(ctx);
        if (!config.syncIssueDocuments || !event.entityId) return;
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          documentKeyHint: null
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.updated failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    ctx.tools.register(
      TOOL_NAMES.getIssueContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getIssueContext) ?? {
        displayName: "Honcho Issue Context",
        description: "Retrieve Honcho context for an issue.",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const issueId = inferIssueId(params, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getIssueContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No Honcho context available for this issue yet.",
          data: context
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchMemory,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchMemory) ?? {
        displayName: "Honcho Search Memory",
        description: "Search Honcho memory",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const scope = input.scope === "workspace" ? "workspace" : "session";
        const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.min(10, Math.floor(input.limit))) : DEFAULT_SEARCH_LIMIT;
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? scope : "workspace",
          limit
        });
        const content = results.length > 0 ? results.map((result, index) => `Result ${index + 1}: ${result.content ?? "(no content)"}`).join("\n\n") : "No Honcho memory results found.";
        return {
          content,
          data: {
            query,
            issueId,
            scope: issueId ? scope : "workspace",
            results
          }
        };
      }
    );
    if (initialConfig.enablePeerChat) {
      ctx.tools.register(
        TOOL_NAMES.askPeer,
        manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.askPeer) ?? {
          displayName: "Honcho Ask Peer",
          description: "Ask a Honcho peer",
          parametersSchema: { type: "object", properties: {} }
        },
        async (params, runCtx) => {
          const config = await getResolvedConfig(ctx);
          if (!config.enablePeerChat) {
            return { error: "Honcho peer chat is disabled in plugin config" };
          }
          assertConfigured(config);
          const input = params;
          const targetPeerId = requireString(input.targetPeerId, "targetPeerId");
          const query = requireString(input.query, "query");
          const issueId = inferIssueId(input, runCtx) ?? void 0;
          const client = await createHonchoClient({ ctx, config });
          const response = await client.askPeer(runCtx.companyId, runCtx.agentId, {
            targetPeerId,
            query,
            issueId
          });
          const content = response.text ?? response.response ?? response.messages?.map((message) => message.content).filter(Boolean).join("\n\n") ?? "No Honcho peer response returned.";
          return {
            content,
            data: response
          };
        }
      );
    }
    ctx.tools.register(
      TOOL_NAMES.getWorkspaceContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getWorkspaceContext) ?? {
        displayName: "Honcho Workspace Context",
        description: "Retrieve Honcho workspace context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = typeof input.query === "string" && input.query.trim() ? input.query.trim() : "recent workspace memory";
        const results = await getWorkspaceContext(ctx, runCtx.agentId, runCtx.companyId, query);
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No workspace context found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchMessages,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchMessages) ?? {
        displayName: "Honcho Search Messages",
        description: "Search raw Honcho messages",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No messages found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.searchConclusions,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.searchConclusions) ?? {
        displayName: "Honcho Search Conclusions",
        description: "Search summarized Honcho memory",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? void 0,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT,
          summaryOnly: true
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No conclusions found.",
          data: results
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getSession,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getSession) ?? {
        displayName: "Honcho Session",
        description: "Retrieve session context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const issueId = inferIssueId(params, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getSessionContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No session context available.",
          data: context
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getAgentContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getAgentContext) ?? {
        displayName: "Honcho Agent Context",
        description: "Retrieve agent peer context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const agentId = requireString(input.agentId ?? runCtx.agentId, "agentId");
        const issueId = inferIssueId(input, runCtx);
        const content = await getAgentContext(ctx, runCtx.companyId, agentId, issueId);
        return {
          content: content ?? "No agent context available.",
          data: { agentId, issueId, content }
        };
      }
    );
    ctx.tools.register(
      TOOL_NAMES.getHierarchyContext,
      manifest_default.tools?.find((tool) => tool.name === TOOL_NAMES.getHierarchyContext) ?? {
        displayName: "Honcho Hierarchy Context",
        description: "Retrieve hierarchy context",
        parametersSchema: { type: "object", properties: {} }
      },
      async (params, runCtx) => {
        const input = params;
        const runId = typeof input.runId === "string" && input.runId.trim().length > 0 ? input.runId.trim() : typeof runCtx.runId === "string" && runCtx.runId.trim().length > 0 ? runCtx.runId.trim() : null;
        const content = runId ? await getHierarchyContext(ctx, runCtx.companyId, runId) : null;
        return {
          content: content ?? "Hierarchy context unavailable on this host.",
          data: { runId, content }
        };
      }
    );
  },
  async onHealth() {
    return { status: "ok", message: "Honcho worker is running" };
  },
  async onValidateConfig(config) {
    return validateConfig(config);
  }
});
var worker_default = plugin;
runWorker(plugin, import.meta.url);

// src/worker-bootstrap.ts
startWorkerRpcHost({ plugin: worker_default });
//# sourceMappingURL=worker-bootstrap.js.map
