import {
  definePlugin,
  runWorker,
  type PluginContext,
  type ToolRunContext,
  type ToolResult,
} from "@paperclipai/plugin-sdk";
import manifest from "./manifest.js";
import { ACTION_KEYS, DATA_KEYS, DEFAULT_SEARCH_LIMIT, JOB_KEYS, RUNTIME_LAUNCHERS, TOOL_NAMES } from "./constants.js";
import { assertConfigured, getResolvedConfig, validateConfig } from "./config.js";
import { createHonchoClient } from "./honcho-client.js";
import { consumePreparedJobCompany, setPreparedJobCompany } from "./state.js";
import {
  initializeMemory,
  getIssueContext,
  getAgentContext,
  getHierarchyContext,
  getSessionContext,
  getWorkspaceContext,
  loadIssueStatusData,
  loadMemoryStatusData,
  loadMigrationJobStatusData,
  loadMigrationPreviewData,
  probePromptContext,
  replayIssue,
  scanMigrationSources,
  searchMemory,
  syncIssue,
  importMigrationPreview,
} from "./sync.js";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function inferIssueId(params: Record<string, unknown>, runCtx?: Partial<ToolRunContext>): string | null {
  if (typeof params.issueId === "string" && params.issueId.trim()) return params.issueId.trim();
  return null;
}

const plugin = definePlugin({
  async setup(ctx) {
    const initialConfig = await getResolvedConfig(ctx);
    for (const launcher of RUNTIME_LAUNCHERS) {
      ctx.launchers.register(launcher);
    }

    ctx.data.register(DATA_KEYS.memoryStatus, async (params) => {
      const companyId = typeof params.companyId === "string" && params.companyId.trim()
        ? params.companyId.trim()
        : null;
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
      const { workspaceId } = await client.probeConnection(companyId ?? undefined, company);
      return {
        ok: true,
        workspaceId,
        at: new Date().toISOString(),
      };
    });

    ctx.actions.register(ACTION_KEYS.resyncIssue, async (params) => {
      const issueId = requireString(params.issueId, "issueId");
      const companyId = requireString(params.companyId, "companyId");
      return await replayIssue(ctx, issueId, companyId);
    });

    ctx.actions.register(ACTION_KEYS.initializeMemoryForCompany, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      await setPreparedJobCompany(ctx, JOB_KEYS.initializeMemory, companyId);
      return { ok: true, companyId };
    });

    ctx.actions.register(ACTION_KEYS.probePromptContext, async (params) => {
      const companyId = requireString(params.companyId, "companyId");
      return await probePromptContext(ctx, companyId, {
        issueId: typeof params.issueId === "string" ? params.issueId : null,
        agentId: typeof params.agentId === "string" ? params.agentId : null,
        prompt: typeof params.prompt === "string" ? params.prompt : null,
      });
    });

    ctx.jobs.register(JOB_KEYS.initializeMemory, async () => {
      const companyId = await consumePreparedJobCompany(ctx, JOB_KEYS.initializeMemory)
        ?? (await ctx.companies.list({ limit: 1, offset: 0 }))[0]?.id;
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
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ctx.events.on("issue.comment.created", async (event) => {
      try {
        if (!event.entityId) return;
        const payload = typeof event.payload === "object" && event.payload !== null
          ? (event.payload as Record<string, unknown>)
          : {};
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          commentIdHint: typeof payload.commentId === "string" ? payload.commentId : null,
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.comment.created failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ctx.events.on("issue.updated", async (event) => {
      try {
        const config = await getResolvedConfig(ctx);
        if (!config.syncIssueDocuments || !event.entityId) return;
        await syncIssue(ctx, event.entityId, event.companyId, {
          replay: false,
          documentKeyHint: null,
        });
      } catch (error) {
        ctx.logger.warn("Honcho sync on issue.updated failed", {
          issueId: event.entityId,
          companyId: event.companyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    ctx.tools.register(
      TOOL_NAMES.getIssueContext,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.getIssueContext) ?? {
        displayName: "Honcho Issue Context",
        description: "Retrieve Honcho context for an issue.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const issueId = inferIssueId(params as Record<string, unknown>, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getIssueContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No Honcho context available for this issue yet.",
          data: context,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.searchMemory,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.searchMemory) ?? {
        displayName: "Honcho Search Memory",
        description: "Search Honcho memory",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const scope = input.scope === "workspace" ? "workspace" : "session";
        const limit = typeof input.limit === "number" && Number.isFinite(input.limit)
          ? Math.max(1, Math.min(10, Math.floor(input.limit)))
          : DEFAULT_SEARCH_LIMIT;
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? undefined,
          scope: issueId ? scope : "workspace",
          limit,
        });
        const content = results.length > 0
          ? results
            .map((result, index) => `Result ${index + 1}: ${result.content ?? "(no content)"}`)
            .join("\n\n")
          : "No Honcho memory results found.";
        return {
          content,
          data: {
            query,
            issueId,
            scope: issueId ? scope : "workspace",
            results,
          },
        };
      },
    );

    if (initialConfig.enablePeerChat) {
      ctx.tools.register(
        TOOL_NAMES.askPeer,
        manifest.tools?.find((tool) => tool.name === TOOL_NAMES.askPeer) ?? {
          displayName: "Honcho Ask Peer",
          description: "Ask a Honcho peer",
          parametersSchema: { type: "object", properties: {} },
        },
        async (params, runCtx): Promise<ToolResult> => {
          const config = await getResolvedConfig(ctx);
          if (!config.enablePeerChat) {
            return { error: "Honcho peer chat is disabled in plugin config" };
          }
          assertConfigured(config);
          const input = params as Record<string, unknown>;
          const targetPeerId = requireString(input.targetPeerId, "targetPeerId");
          const query = requireString(input.query, "query");
          const issueId = inferIssueId(input, runCtx) ?? undefined;
          const client = await createHonchoClient({ ctx, config });
          const response = await client.askPeer(runCtx.companyId, runCtx.agentId, {
            targetPeerId,
            query,
            issueId,
          });
          const content = response.text ?? response.response ?? response.messages?.map((message) => message.content).filter(Boolean).join("\n\n") ?? "No Honcho peer response returned.";
          return {
            content,
            data: response,
          };
        },
      );
    }

    ctx.tools.register(
      TOOL_NAMES.getWorkspaceContext,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.getWorkspaceContext) ?? {
        displayName: "Honcho Workspace Context",
        description: "Retrieve Honcho workspace context",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const query = typeof input.query === "string" && input.query.trim() ? input.query.trim() : "recent workspace memory";
        const results = await getWorkspaceContext(ctx, runCtx.agentId, runCtx.companyId, query);
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No workspace context found.",
          data: results,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.searchMessages,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.searchMessages) ?? {
        displayName: "Honcho Search Messages",
        description: "Search raw Honcho messages",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? undefined,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT,
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No messages found.",
          data: results,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.searchConclusions,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.searchConclusions) ?? {
        displayName: "Honcho Search Conclusions",
        description: "Search summarized Honcho memory",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const query = requireString(input.query, "query");
        const issueId = inferIssueId(input, runCtx);
        const results = await searchMemory(ctx, runCtx.agentId, runCtx.companyId, {
          query,
          issueId: issueId ?? undefined,
          scope: issueId ? "session" : "workspace",
          limit: typeof input.limit === "number" ? input.limit : DEFAULT_SEARCH_LIMIT,
          summaryOnly: true,
        });
        return {
          content: results.map((result) => result.content).filter(Boolean).join("\n\n") || "No conclusions found.",
          data: results,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getSession,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.getSession) ?? {
        displayName: "Honcho Session",
        description: "Retrieve session context",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const issueId = inferIssueId(params as Record<string, unknown>, runCtx);
        if (!issueId) return { error: "issueId is required" };
        const context = await getSessionContext(ctx, issueId, runCtx.companyId);
        return {
          content: context.preview ?? "No session context available.",
          data: context,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getAgentContext,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.getAgentContext) ?? {
        displayName: "Honcho Agent Context",
        description: "Retrieve agent peer context",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const agentId = requireString(input.agentId ?? runCtx.agentId, "agentId");
        const issueId = inferIssueId(input, runCtx);
        const content = await getAgentContext(ctx, runCtx.companyId, agentId, issueId);
        return {
          content: content ?? "No agent context available.",
          data: { agentId, issueId, content },
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getHierarchyContext,
      manifest.tools?.find((tool) => tool.name === TOOL_NAMES.getHierarchyContext) ?? {
        displayName: "Honcho Hierarchy Context",
        description: "Retrieve hierarchy context",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const input = params as Record<string, unknown>;
        const runId = typeof input.runId === "string" && input.runId.trim().length > 0
          ? input.runId.trim()
          : typeof runCtx.runId === "string" && runCtx.runId.trim().length > 0
            ? runCtx.runId.trim()
            : null;
        const content = runId ? await getHierarchyContext(ctx, runCtx.companyId, runId) : null;
        return {
          content: content ?? "Hierarchy context unavailable on this host.",
          data: { runId, content },
        };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "Honcho worker is running" };
  },

  async onValidateConfig(config) {
    return validateConfig(config);
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
