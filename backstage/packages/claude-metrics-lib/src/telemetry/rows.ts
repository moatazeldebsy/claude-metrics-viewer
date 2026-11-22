// Turn decoded OTLP points from Claude Code into daily increments per (day, actor, terminal, model).
// Only the counters below are kept; session ids and every other attribute are dropped.
import { createHash } from "node:crypto";
import type { OtlpPoint } from "./otlp";

export type TelemetryCounter =
  | "sessions" | "linesAdded" | "linesRemoved" | "commits" | "prs" | "costUsd"
  | "tokensInput" | "tokensOutput" | "tokensCacheRead" | "tokensCacheCreation"
  | "editAccepted" | "editRejected" | "writeAccepted" | "writeRejected"
  | "notebookAccepted" | "notebookRejected" | "activeSecondsUser" | "activeSecondsCli";

export const TELEMETRY_COUNTERS: readonly TelemetryCounter[] = [
  "sessions", "linesAdded", "linesRemoved", "commits", "prs", "costUsd",
  "tokensInput", "tokensOutput", "tokensCacheRead", "tokensCacheCreation",
  "editAccepted", "editRejected", "writeAccepted", "writeRejected",
  "notebookAccepted", "notebookRejected", "activeSecondsUser", "activeSecondsCli",
];

export interface TelemetryKey {
  day: string; // YYYY-MM-DD, UTC
  actorKind: "user" | "api";
  actor: string;
  terminal: string;
  model: string; // "" for metrics without a model
}
export interface TelemetryRow extends TelemetryKey {
  counters: Partial<Record<TelemetryCounter, number>>;
}
export interface TelemetryUser {
  actorKind: "user" | "api";
  actor: string;
  department: string | null;
  lastSeen: string; // YYYY-MM-DD
}
export interface TelemetryBatch {
  rows: TelemetryRow[];
  users: TelemetryUser[];
}

export class CumulativeTemporalityError extends Error {
  constructor() {
    super(
      "Cumulative temporality isn't supported. Remove OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative (Claude Code sends delta by default).",
    );
  }
}

const TOKEN_TYPES: Record<string, TelemetryCounter> = {
  input: "tokensInput",
  output: "tokensOutput",
  cacheRead: "tokensCacheRead",
  cacheCreation: "tokensCacheCreation",
};
const EDIT_TOOLS: Record<string, "edit" | "write" | "notebook"> = { Edit: "edit", Write: "write", NotebookEdit: "notebook" };

/** Which counter a point increments, or undefined to ignore it. */
function counterFor(p: OtlpPoint): TelemetryCounter | undefined {
  const a = p.attributes;
  switch (p.metric) {
    case "claude_code.session.count": return "sessions";
    case "claude_code.commit.count": return "commits";
    case "claude_code.pull_request.count": return "prs";
    case "claude_code.cost.usage": return "costUsd";
    case "claude_code.lines_of_code.count":
      return a.type === "added" ? "linesAdded" : a.type === "removed" ? "linesRemoved" : undefined;
    case "claude_code.token.usage":
      return TOKEN_TYPES[String(a.type)];
    case "claude_code.active_time.total":
      return a.type === "user" ? "activeSecondsUser" : a.type === "cli" ? "activeSecondsCli" : undefined;
    case "claude_code.code_edit_tool.decision": {
      const tool = EDIT_TOOLS[String(a.tool_name)];
      const decision = a.decision === "accept" ? "Accepted" : a.decision === "reject" ? "Rejected" : undefined;
      return tool && decision ? (`${tool}${decision}` as TelemetryCounter) : undefined;
    }
    default: return undefined;
  }
}

const dayOf = (ns: bigint) => new Date(Number(ns / 1_000_000n)).toISOString().slice(0, 10);
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);

/** A stable label for users without an email that doesn't reveal the raw user.id. */
const pseudonym = (userId: string) => `user-${createHash("sha256").update(userId).digest("hex").slice(0, 10)}`;

export function toTelemetryBatch(points: OtlpPoint[]): TelemetryBatch {
  const rows = new Map<string, TelemetryRow>();
  const users = new Map<string, TelemetryUser>();
  for (const p of points) {
    if (!p.metric.startsWith("claude_code.") || p.kind !== "sum") continue;
    if (p.temporality === "cumulative") throw new CumulativeTemporalityError();
    const counter = counterFor(p);
    if (!counter || !Number.isFinite(p.value)) continue;

    const email = str(p.attributes["user.email"]);
    const actorKind = email ? "user" : "api";
    const actor = email ?? pseudonym(str(p.attributes["user.id"]) ?? "unknown");
    const day = dayOf(p.timeUnixNano);
    const key: TelemetryKey = { day, actorKind, actor, terminal: str(p.attributes["terminal.type"]) ?? "unknown", model: str(p.attributes.model) ?? "" };
    const id = JSON.stringify(key);
    const row = rows.get(id) ?? { ...key, counters: {} };
    row.counters[counter] = (row.counters[counter] ?? 0) + p.value;
    rows.set(id, row);

    const department = str(p.attributes.department) ?? str(p.resource.department) ?? null;
    const prev = users.get(`${actorKind}:${actor}`);
    if (!prev || day >= prev.lastSeen) users.set(`${actorKind}:${actor}`, { actorKind, actor, department: department ?? prev?.department ?? null, lastSeen: day });
  }
  return { rows: [...rows.values()], users: [...users.values()] };
}
