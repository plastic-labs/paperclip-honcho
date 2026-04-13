import type { Agent, Company, Issue, PluginContext } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONTEXT_SUMMARY_LIMIT, DEFAULT_CONTEXT_TOKEN_LIMIT, HONCHO_V3_PATH } from "./constants.js";
import { isHonchoCloudBaseUrl } from "./deployment.js";
import { resolveCanonicalWorkspaceId } from "./entities.js";
import { peerIdForAgent, peerIdForUser, sessionIdForIssue } from "./ids.js";
import type {
  AskPeerParams,
  HonchoChatResult,
  HonchoClientInput,
  HonchoIssueContext,
  HonchoMessageInput,
  HonchoRepresentationResult,
  HonchoResolvedConfig,
  HonchoSearchResult,
  HonchoSessionContextResult,
  HonchoSessionSummary,
  SearchMemoryParams,
} from "./types.js";

type JsonRecord = Record<string, unknown>;
const RATE_LIMIT_MAX_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJson(res: Response | { status: number; body: string }) {
  if ("json" in res) {
    const text = await res.text();
    return text ? JSON.parse(text) as JsonRecord : {};
  }
  return res.body ? JSON.parse(res.body) as JsonRecord : {};
}

function isRateLimitError(status: number, message: string): boolean {
  return status === 429 || /rate limit exceeded/i.test(message);
}

function getRetryDelayMs(res: Response | { status: number; body: string }, attempt: number): number {
  if ("headers" in res && typeof res.headers?.get === "function") {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds * 1000);
      }
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) {
        return Math.max(0, retryAt - Date.now());
      }
    }
  }
  return RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
}

function joinUrl(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${pathname}`;
}

function buildIssueContextPreview(payload: HonchoSessionContextResult): string | null {
  const candidates: string[] = [];
  const summaryText = typeof payload.summary === "string"
    ? payload.summary
    : typeof payload.summary?.content === "string"
      ? payload.summary.content
      : null;
  if (typeof summaryText === "string" && summaryText.trim()) {
    candidates.push(summaryText.trim());
  }
  if (typeof payload.context === "string" && payload.context.trim()) {
    candidates.push(payload.context.trim());
  } else if (typeof payload.content === "string" && payload.content.trim()) {
    candidates.push(payload.content.trim());
  }
  if (candidates.length === 0 && Array.isArray(payload.messages)) {
    const messagePreview = payload.messages
      .map((message) => typeof message.content === "string" ? message.content.trim() : "")
      .filter((value) => value.length > 0)
      .slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT)
      .join("\n\n")
      .trim();
    if (messagePreview) candidates.push(messagePreview);
  }
  return candidates[0] ?? null;
}

function buildRepresentationPreview(payload: HonchoRepresentationResult): string | null {
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
    const preview = payload.results
      .map((result) => typeof result.content === "string" ? result.content.trim() : "")
      .filter(Boolean)
      .slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT)
      .join("\n\n")
      .trim();
    return preview || null;
  }
  return null;
}

async function requestJson(
  ctx: PluginContext,
  config: HonchoResolvedConfig,
  apiKey: string | null,
  pathname: string,
  init: RequestInit,
): Promise<JsonRecord> {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const res = await ctx.http.fetch(joinUrl(config.honchoApiBaseUrl, pathname), {
      ...init,
      headers: {
        ...headers,
        ...(init.headers ?? {}),
      },
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
      // ignore parse errors
    }

    if (isRateLimitError(status, message) && attempt < RATE_LIMIT_MAX_RETRIES) {
      await sleep(getRetryDelayMs(res, attempt));
      continue;
    }

    throw new Error(message);
  }

  throw new Error(`${pathname} failed after exhausting retries`);
}

export class HonchoClient {
  private readonly ctx: PluginContext;
  private readonly config: HonchoResolvedConfig;
  private readonly apiKey: string | null;
  private readonly ensuredWorkspaces = new Set<string>();
  private readonly ensuredSessions = new Set<string>();
  private readonly ensuredPeers = new Set<string>();
  private readonly resolvedWorkspaceIds = new Map<string, string>();

  constructor(input: HonchoClientInput & { apiKey: string | null }) {
    this.ctx = input.ctx;
    this.config = input.config;
    this.apiKey = input.apiKey;
  }

  private async workspaceId(companyId: string): Promise<string> {
    const cachedWorkspaceId = this.resolvedWorkspaceIds.get(companyId);
    if (cachedWorkspaceId) {
      return cachedWorkspaceId;
    }
    const workspaceId = await resolveCanonicalWorkspaceId(this.ctx, companyId, this.config.workspacePrefix);
    this.resolvedWorkspaceIds.set(companyId, workspaceId);
    return workspaceId;
  }

  sessionId(issueId: string): string {
    return sessionIdForIssue(issueId);
  }

  async ensureWorkspace(companyId: string): Promise<string> {
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
        },
      }),
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }

  async ensureCompanyWorkspace(companyId: string, company: Company | null): Promise<string> {
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
          company_issue_prefix: company?.issuePrefix ?? null,
        },
      }),
    });
    this.ensuredWorkspaces.add(workspaceId);
    return workspaceId;
  }

  async probeConnection(companyId?: string, company?: Company | null): Promise<{ workspaceId: string | null }> {
    if (!companyId) {
      return { workspaceId: null };
    }
    const workspaceId = await this.ensureCompanyWorkspace(companyId, company ?? null);
    return { workspaceId };
  }

  async ensurePeer(
    companyId: string,
    peerId: string,
    metadata?: Record<string, unknown>,
    peerConfig?: Record<string, unknown>,
  ): Promise<string> {
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
          ...metadata,
        },
      }),
    });
    this.ensuredPeers.add(cacheKey);
    return peerId;
  }

  async ensureAgentPeer(companyId: string, agent: Agent): Promise<string> {
    return await this.ensurePeer(
      companyId,
      peerIdForAgent(agent.id),
      {
        company_id: companyId,
        agent_id: agent.id,
        agent_name: agent.name,
        agent_role: agent.role,
        agent_title: agent.title,
      },
      {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others,
      },
    );
  }

  async ensureUserPeer(
    companyId: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    return await this.ensurePeer(
      companyId,
      peerIdForUser(userId),
      {
        company_id: companyId,
        user_id: userId,
        ...metadata,
      },
    );
  }

  async ensureSession(companyId: string, issueId: string, metadata?: Record<string, unknown>): Promise<string> {
    return await this.ensureRawSession(companyId, this.sessionId(issueId), {
      source_system: "paperclip",
      company_id: companyId,
      issue_id: issueId,
      ...metadata,
    });
  }

  async ensureRawSession(companyId: string, sessionId: string, metadata?: Record<string, unknown>): Promise<string> {
    const workspaceId = await this.ensureWorkspace(companyId);
    const cacheKey = `${workspaceId}:${sessionId}`;
    if (this.ensuredSessions.has(cacheKey)) {
      return sessionId;
    }
    await requestJson(this.ctx, this.config, this.apiKey, `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        id: sessionId,
        metadata,
      }),
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }

  async ensureIssueSession(issue: Issue, company: Company | null): Promise<string> {
    const workspaceId = await this.ensureCompanyWorkspace(issue.companyId, company);
    const sessionId = this.sessionId(issue.id);
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
          assignee_user_id: issue.assigneeUserId,
        },
      }),
    });
    this.ensuredSessions.add(cacheKey);
    return sessionId;
  }

  async appendMessages(companyId: string, issueId: string, messages: HonchoMessageInput[]): Promise<void> {
    if (messages.length === 0) return;
    const sessionId = await this.ensureSession(companyId, issueId);
    await this.appendMessagesToSession(companyId, sessionId, messages);
  }

  async appendMessagesToSession(companyId: string, sessionId: string, messages: HonchoMessageInput[]): Promise<void> {
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
            metadata: message.metadata,
          })),
        }),
      },
    );
  }

  async getIssueContext(companyId: string, issueId: string, userPeerId?: string | null): Promise<HonchoIssueContext> {
    const sessionId = await this.ensureSession(companyId, issueId);
    return await this.getSessionContext(companyId, sessionId, userPeerId, issueId);
  }

  async getSessionContext(
    companyId: string,
    sessionId: string,
    userPeerId?: string | null,
    issueId?: string | null,
  ): Promise<HonchoIssueContext> {
    const workspaceId = await this.workspaceId(companyId);
    const query = new URLSearchParams({
      summary: "true",
      tokens: String(DEFAULT_CONTEXT_TOKEN_LIMIT),
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
        method: "GET",
      },
    );
    const contextPayload = payload as HonchoSessionContextResult;
    const summaryContent = typeof contextPayload.summary === "string"
      ? contextPayload.summary
      : typeof contextPayload.summary?.content === "string"
        ? contextPayload.summary.content
        : null;
    const summaries: HonchoSessionSummary[] = summaryContent && summaryContent.trim()
      ? [{ summary: summaryContent }]
      : Array.isArray(contextPayload.messages)
        ? contextPayload.messages.reduce<HonchoSessionSummary[]>((items, message) => {
          if (typeof message.content === "string" && message.content.trim()) {
            items.push({ content: message.content, metadata: message.metadata ?? null });
          }
          return items;
        }, []).slice(0, DEFAULT_CONTEXT_SUMMARY_LIMIT)
        : [];
    const preview = buildIssueContextPreview(contextPayload);
    return {
      issueId: issueId ?? sessionId,
      issueIdentifier: null,
      sessionId,
      workspaceId,
      summaries,
      context: contextPayload,
      preview,
    };
  }

  async getPeerRepresentation(
    companyId: string,
    agentId: string,
    params: { issueId?: string | null; summaryOnly?: boolean },
  ): Promise<string | null> {
    const workspaceId = await this.workspaceId(companyId);
    const payload = await requestJson(
      this.ctx,
      this.config,
      this.apiKey,
      `${HONCHO_V3_PATH}/workspaces/${encodeURIComponent(workspaceId)}/peers/${encodeURIComponent(peerIdForAgent(agentId))}/representation`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(params.issueId ? { session_id: this.sessionId(params.issueId) } : {}),
          ...(params.summaryOnly ? { summary_only: true } : {}),
        }),
      },
    );
    return buildRepresentationPreview(payload as HonchoRepresentationResult);
  }

  async searchMemory(companyId: string, agentId: string, params: SearchMemoryParams): Promise<HonchoSearchResult[]> {
    const agent = await this.ctx.agents.get(agentId, companyId);
    if (agent) {
      await this.ensureAgentPeer(companyId, agent);
    } else {
      await this.ensurePeer(companyId, peerIdForAgent(agentId), {
        company_id: companyId,
        agent_id: agentId,
      }, {
        observe_me: this.config.observe_me,
        observe_others: this.config.observe_others,
      });
    }
    const workspaceId = await this.workspaceId(companyId);
    const scopedSessionId = params.scope === "workspace" ? undefined : params.issueId ? this.sessionId(params.issueId) : undefined;
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
          ...(params.summaryOnly ? { summary_only: true } : {}),
        }),
      },
    );
    const data = payload as HonchoRepresentationResult;
    if (Array.isArray(data.results)) return data.results;
    if (typeof data.representation === "string" && data.representation.trim()) {
      return [{ id: "representation", content: data.representation, metadata: data.metadata ?? null, score: null }];
    }
    if (typeof data.content === "string" && data.content.trim()) {
      return [{ id: "content", content: data.content, metadata: data.metadata ?? null, score: null }];
    }
    return [];
  }

  async askPeer(companyId: string, agentId: string, params: AskPeerParams): Promise<HonchoChatResult> {
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
          session_id: params.issueId ? this.sessionId(params.issueId) : undefined,
        }),
      },
    );
    return payload as HonchoChatResult;
  }

  async getWorkspaceContext(companyId: string, agentId: string, query: string): Promise<HonchoSearchResult[]> {
    return await this.searchMemory(companyId, agentId, {
      query,
      scope: "workspace",
      limit: DEFAULT_CONTEXT_SUMMARY_LIMIT,
    });
  }
}

export async function createHonchoClient(input: HonchoClientInput): Promise<HonchoClient> {
  const apiKey = input.config.honchoApiKey
    ? await input.ctx.secrets.resolve(input.config.honchoApiKey)
    : null;
  return new HonchoClient({ ...input, apiKey });
}
