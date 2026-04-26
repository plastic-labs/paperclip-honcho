import { vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import type {
  Agent,
  Company,
  Issue,
  IssueComment,
  Project,
} from "@paperclipai/plugin-sdk";
import manifest from "../src/manifest.js";
import type { DocumentRevision } from "../src/types.js";

export const BASE_CONFIG = {
  honchoApiBaseUrl: "https://api.honcho.dev",
  honchoApiKey: "HONCHO_API_KEY",
  allowUnsafePrivateNetwork: false,
  workspacePrefix: "paperclip",
  syncIssueComments: true,
  syncIssueDocuments: true,
  enablePromptContext: false,
  enablePeerChat: true,
  observe_me: true,
  observe_others: true,
  noisePatterns: [],
  disableDefaultNoisePatterns: false,
  stripPlatformMetadata: true,
  flushBeforeReset: false,
};

export type SeedOverrides = {
  companies?: Company[];
  projects?: Project[];
  issues?: Issue[];
  issueComments?: IssueComment[];
  issueDocuments?: StandaloneIssueDocument[];
  documentRevisions?: DocumentRevision[];
  agents?: Agent[];
};

export type StandaloneIssueDocument = {
  id: string;
  companyId: string;
  issueId: string;
  key: string;
  title: string | null;
  format: string;
  body: string;
  latestRevisionId: string | null;
  latestRevisionNumber: number | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
  updatedByAgentId?: string | null;
  updatedByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CapturedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
};

type FetchMockOptions = {
  failOn?: Array<string | RegExp>;
  failOnceOn?: Array<string | RegExp>;
  returnNullOnceOn?: Array<string | RegExp>;
  rateLimitOnceOn?: Array<string | RegExp>;
  delayOn?: Array<{ pattern: string | RegExp; ms: number }>;
  searchResults?: Array<Record<string, unknown>>;
  summaries?: string[];
  chatText?: string;
  workspaceResponse?: Record<string, unknown>;
  existingSessionMessages?: Record<string, Array<Record<string, unknown>>>;
};

function matchesPattern(url: string, pattern: string | RegExp): boolean {
  return typeof pattern === "string" ? url.includes(pattern) : pattern.test(url);
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> | null {
  if (typeof body !== "string" || body.length === 0) return null;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  const normalized: Record<string, string> = {};
  const assignHeader = (key: string, value: string) => {
    normalized[key.toLowerCase()] = value;
  };

  if (headers instanceof Headers) {
    headers.forEach((value, key) => assignHeader(key, value));
    return normalized;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      assignHeader(key, value);
    }
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      assignHeader(key, value);
    }
  }
  return normalized;
}

export function installFetchMock(options: FetchMockOptions = {}) {
  const requests: CapturedRequest[] = [];
  const sessionMessages = new Map<string, Array<Record<string, unknown>>>(
    Object.entries(options.existingSessionMessages ?? {}),
  );
  const remainingFailOnce = new Map<string | RegExp, number>(
    (options.failOnceOn ?? []).map((pattern) => [pattern, 1]),
  );
  const remainingReturnNullOnce = new Map<string | RegExp, number>(
    (options.returnNullOnceOn ?? []).map((pattern) => [pattern, 1]),
  );
  const remainingRateLimitOnce = new Map<string | RegExp, number>(
    (options.rateLimitOnceOn ?? []).map((pattern) => [pattern, 1]),
  );
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: parseHeaders(init?.headers),
      body: parseBody(init?.body),
    });

    if (options.failOn?.some((pattern) => matchesPattern(url, pattern))) {
      return new Response(JSON.stringify({ error: "forced failure" }), { status: 500 });
    }
    for (const [pattern, remaining] of remainingFailOnce.entries()) {
      if (remaining > 0 && matchesPattern(url, pattern)) {
        remainingFailOnce.set(pattern, remaining - 1);
        return new Response(JSON.stringify({ error: "forced failure" }), { status: 500 });
      }
    }
    for (const [pattern, remaining] of remainingReturnNullOnce.entries()) {
      if (remaining > 0 && matchesPattern(url, pattern)) {
        remainingReturnNullOnce.set(pattern, remaining - 1);
        return null as unknown as Response;
      }
    }
    for (const [pattern, remaining] of remainingRateLimitOnce.entries()) {
      if (remaining > 0 && matchesPattern(url, pattern)) {
        remainingRateLimitOnce.set(pattern, remaining - 1);
        return new Response(JSON.stringify({ error: "Rate limit exceeded: 5 per 1 second" }), {
          status: 429,
          headers: {
            "retry-after": "0.01",
          },
        });
      }
    }
    for (const delay of options.delayOn ?? []) {
      if (matchesPattern(url, delay.pattern)) {
        await new Promise((resolve) => setTimeout(resolve, delay.ms));
      }
    }

    if (url.endsWith("/v3/workspaces")) {
      return new Response(JSON.stringify(options.workspaceResponse ?? { ok: true }), { status: 200 });
    }
    if (url.includes("/representation")) {
      return new Response(JSON.stringify({
        results: options.searchResults ?? [
          {
            id: "search-1",
            content: "Relevant memory hit",
            metadata: { sourceSystem: "paperclip", issueId: "iss_1" },
            score: 0.98,
          },
        ],
      }), { status: 200 });
    }
    if (url.includes("/chat")) {
      return new Response(JSON.stringify({ text: options.chatText ?? "Peer answer" }), { status: 200 });
    }
    if (url.includes("/peers")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/sessions") && !url.includes("/messages") && !url.includes("/context")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/messages")) {
      const urlWithoutQuery = url.split("?", 1)[0] ?? url;
      const sessionMatch = urlWithoutQuery.match(/\/workspaces\/([^/]+)\/sessions\/([^/]+)\/messages(?:\/list)?$/);
      const sessionKey = sessionMatch ? `${decodeURIComponent(sessionMatch[1] ?? "")}/${decodeURIComponent(sessionMatch[2] ?? "")}` : null;
      if (urlWithoutQuery.endsWith("/messages/list")) {
        const items = sessionKey ? (sessionMessages.get(sessionKey) ?? []) : [];
        return new Response(JSON.stringify({
          items,
          total: items.length,
          page: 1,
          size: Math.max(1, items.length),
          pages: 1,
        }), { status: 200 });
      }
      if (sessionKey) {
        const existing = sessionMessages.get(sessionKey) ?? [];
        const incoming = ((parseBody(init?.body)?.messages as Array<Record<string, unknown>> | undefined) ?? []).map((message, index) => ({
          id: `${sessionKey}:msg_${existing.length + index + 1}`,
          content: message.content ?? null,
          metadata: message.metadata ?? null,
          peer_id: message.peer_id ?? null,
          created_at: message.created_at ?? null,
        }));
        sessionMessages.set(sessionKey, [...existing, ...incoming]);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/context")) {
      return new Response(JSON.stringify({
        summary: {
          content: options.summaries?.[0] ?? "Investigating auth regression and next steps.",
        },
        messages: (options.summaries ?? ["Investigating auth regression and next steps."]).map((summary) => ({
          role: "assistant",
          content: summary,
        })),
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, requests };
}

export function requestsMatching(requests: CapturedRequest[], pattern: string): CapturedRequest[] {
  return requests.filter((request) => request.url.includes(pattern));
}

export function buildDefaultFixtures(): Required<SeedOverrides> {
  const companies: Company[] = [{
    id: "co_1",
    name: "Paperclip",
    description: null,
    status: "active",
    pauseReason: null,
    pausedAt: null,
    issuePrefix: "PAP",
    issueCounter: 1,
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    requireBoardApprovalForNewAgents: true,
    brandColor: null,
    logoAssetId: null,
    logoUrl: null,
    feedbackDataSharingEnabled: false,
    feedbackDataSharingConsentAt: null,
    feedbackDataSharingConsentByUserId: null,
    feedbackDataSharingTermsVersion: null,
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    updatedAt: new Date("2026-03-15T12:00:00.000Z"),
  }];

  const issues: Issue[] = [{
    id: "iss_1",
    companyId: "co_1",
    projectId: "proj_1",
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Fix auth regression",
    description: "Need to investigate auth failures.",
    status: "todo",
    priority: "high",
    assigneeAgentId: "agent_1",
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: "user_1",
    issueNumber: 1,
    identifier: "PAP-1",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceSettings: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    updatedAt: new Date("2026-03-15T12:00:00.000Z"),
  }];

  const projects: Project[] = [{
    id: "proj_1",
    companyId: "co_1",
    name: "Paperclip Core",
    description: "Main project",
    status: "in_progress",
    goalId: null,
    color: null,
    pausedAt: null,
    pauseReason: null,
    executionWorkspacePolicy: "inherit_project",
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    updatedAt: new Date("2026-03-15T12:00:00.000Z"),
    primaryWorkspace: {
      id: "ws_1",
      projectId: "proj_1",
      name: "paperclip",
      cwd: "/tmp/paperclip-workspace",
      repoUrl: null,
      sourceType: "local_path",
      providerRef: null,
      isPrimary: true,
      createdAt: new Date("2026-03-15T12:00:00.000Z"),
      updatedAt: new Date("2026-03-15T12:00:00.000Z"),
    },
    codebase: {
      primaryWorkspaceId: "ws_1",
      effectiveLocalFolder: "/tmp/paperclip-workspace",
      effectiveRepoUrl: null,
      workspaces: [],
    },
  } as unknown as Project];

  const issueComments: IssueComment[] = [
    {
      id: "c_1",
      companyId: "co_1",
      issueId: "iss_1",
      authorAgentId: null,
      authorUserId: "user_1",
      body: "First comment",
      createdAt: new Date("2026-03-15T12:01:00.000Z"),
      updatedAt: new Date("2026-03-15T12:01:00.000Z"),
    },
    {
      id: "c_2",
      companyId: "co_1",
      issueId: "iss_1",
      authorAgentId: "agent_1",
      authorUserId: null,
      body: "Second comment",
      createdAt: new Date("2026-03-15T12:02:00.000Z"),
      updatedAt: new Date("2026-03-15T12:02:00.000Z"),
    },
  ];

  const issueDocuments: StandaloneIssueDocument[] = [{
    id: "doc_1",
    companyId: "co_1",
    issueId: "iss_1",
    key: "design",
    title: "Design Notes",
    format: "markdown",
    body: "# Design\n\nStable chunk one.\n\nStable chunk two.",
    latestRevisionId: "rev_2",
    latestRevisionNumber: 2,
    createdByAgentId: null,
    createdByUserId: "user_1",
    updatedByAgentId: "agent_1",
    updatedByUserId: null,
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    updatedAt: new Date("2026-03-15T12:03:00.000Z"),
  }];

  const documentRevisions: DocumentRevision[] = [
    {
      id: "rev_1",
      companyId: "co_1",
      documentId: "doc_1",
      issueId: "iss_1",
      key: "design",
      revisionNumber: 1,
      body: "# Design\n\nInitial body.",
      changeSummary: "Initial",
      createdByAgentId: null,
      createdByUserId: "user_1",
      createdAt: new Date("2026-03-15T12:00:00.000Z"),
    },
    {
      id: "rev_2",
      companyId: "co_1",
      documentId: "doc_1",
      issueId: "iss_1",
      key: "design",
      revisionNumber: 2,
      body: "# Design\n\nStable chunk one.\n\nStable chunk two.",
      changeSummary: "Update",
      createdByAgentId: "agent_1",
      createdByUserId: null,
      createdAt: new Date("2026-03-15T12:03:00.000Z"),
    },
  ];

  const agents: Agent[] = [{
    id: "agent_1",
    companyId: "co_1",
    name: "Agent One",
    role: "engineer",
    title: null,
    status: "idle",
    reportsTo: null,
    capabilities: null,
    adapterType: "process",
    adapterConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    lastHeartbeatAt: null,
    metadata: null,
    permissions: { canCreateAgents: false },
    runtimeConfig: {},
    urlKey: "agent-one",
    icon: "bot",
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    updatedAt: new Date("2026-03-15T12:00:00.000Z"),
  }];

  return {
    companies,
    projects,
    issues,
    issueComments,
    issueDocuments,
    documentRevisions,
    agents,
  };
}

export function createHonchoHarness(options: {
  config?: Partial<typeof BASE_CONFIG>;
  seed?: SeedOverrides;
} = {}) {
  const harness = createTestHarness({
    manifest,
    config: {
      ...BASE_CONFIG,
      ...(options.config ?? {}),
    },
  });
  const defaults = buildDefaultFixtures();
  harness.seed({
    companies: options.seed?.companies ?? defaults.companies,
    projects: options.seed?.projects ?? defaults.projects,
    issues: options.seed?.issues ?? defaults.issues,
    issueComments: options.seed?.issueComments ?? defaults.issueComments,
    agents: options.seed?.agents ?? defaults.agents,
  });
  const issueDocuments = options.seed?.issueDocuments ?? defaults.issueDocuments;
  const documentRevisions = options.seed?.documentRevisions ?? defaults.documentRevisions;
  harness.ctx.issues.documents.list = async (issueId, companyId) => {
    return issueDocuments
      .filter((document) => document.issueId === issueId && document.companyId === companyId)
      .map((document) => ({
        id: document.id,
        companyId: document.companyId,
        issueId: document.issueId,
        key: document.key,
        title: document.title,
        format: "markdown" as const,
        latestRevisionId: document.latestRevisionId ?? `${document.id}:latest`,
        latestRevisionNumber: document.latestRevisionNumber ?? 1,
        createdByAgentId: document.createdByAgentId ?? null,
        createdByUserId: document.createdByUserId ?? null,
        updatedByAgentId: document.updatedByAgentId ?? null,
        updatedByUserId: document.updatedByUserId ?? null,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }));
  };
  harness.ctx.issues.documents.get = async (issueId, key, companyId) => {
    const document = issueDocuments.find((candidate) => candidate.issueId === issueId && candidate.companyId === companyId && candidate.key === key);
    if (!document) return null;
    const latestRevision = documentRevisions
      .filter((revision) => revision.issueId === issueId && revision.key === key)
      .sort((left, right) => left.revisionNumber - right.revisionNumber)
      .at(-1);
    return {
      id: document.id,
      companyId: document.companyId,
      issueId: document.issueId,
      key: document.key,
      title: document.title,
      format: "markdown" as const,
      body: latestRevision?.body ?? document.body,
      latestRevisionId: latestRevision?.id ?? document.latestRevisionId ?? `${document.id}:latest`,
      latestRevisionNumber: latestRevision?.revisionNumber ?? document.latestRevisionNumber ?? 1,
      createdByAgentId: document.createdByAgentId ?? null,
      createdByUserId: document.createdByUserId ?? null,
      updatedByAgentId: latestRevision?.createdByAgentId ?? document.updatedByAgentId ?? null,
      updatedByUserId: latestRevision?.createdByUserId ?? document.updatedByUserId ?? null,
      updatedAt: new Date(latestRevision?.createdAt ?? document.updatedAt),
      createdAt: document.createdAt,
    };
  };
  return harness;
}
