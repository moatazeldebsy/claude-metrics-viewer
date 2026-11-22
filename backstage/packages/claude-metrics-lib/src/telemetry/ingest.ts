// The OTLP/HTTP metrics endpoint shared by both hosts: auth, decoding, and storing one export request.
import { createHash, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { decodeOtlpJson, decodeOtlpProtobuf, OtlpDecodeError } from "./otlp";
import { CumulativeTemporalityError, toTelemetryBatch } from "./rows";
import type { TelemetryStore } from "./store";

export const OTLP_MAX_BODY_BYTES = 5 * 1024 * 1024;

export interface IngestRequest {
  body: Uint8Array;
  contentType: string | undefined;
  contentEncoding: string | undefined;
  /** Value of the Authorization header. */
  authorization: string | undefined;
}

export interface IngestResponse {
  status: number;
  contentType: string;
  body: Uint8Array | string;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time comparison against every configured token. */
function tokenMatches(authorization: string | undefined, tokens: string[]): boolean {
  const match = /^bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!match) return false;
  const given = digest(match[1]!.trim());
  let ok = false;
  for (const t of tokens) ok = timingSafeEqual(given, digest(t)) || ok;
  return ok;
}

const failure = (contentType: string | undefined) => {
  const isJson = (contentType ?? "").split(";")[0]!.trim().toLowerCase() === "application/json";
  return (status: number, message: string): IngestResponse =>
    isJson
      ? { status, contentType: "application/json", body: JSON.stringify({ message }) }
      : { status, contentType: "text/plain; charset=utf-8", body: message };
};

/**
 * The token check on its own, from headers only: hosts call it before reading the body, so an
 * unauthenticated client can't make the server buffer anything. Undefined means authorized.
 */
export function checkIngestAuth(req: Pick<IngestRequest, "contentType" | "authorization">, tokens: string[]): IngestResponse | undefined {
  const fail = failure(req.contentType);
  const usable = tokens.filter((t) => t.trim() !== "");
  if (usable.length === 0) return fail(503, "OTLP ingest is disabled: no ingest tokens are configured.");
  if (!tokenMatches(req.authorization, usable)) return fail(401, "Missing or invalid ingest token.");
  return undefined;
}

/** Collect a request body, giving up (null) as soon as it passes maxBytes. */
export async function readBodyCapped(chunks: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    total += chunk.byteLength;
    if (total > maxBytes) return null;
    parts.push(chunk);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

export async function handleOtlpIngest(
  req: IngestRequest,
  opts: { tokens: string[]; store: TelemetryStore; now?: Date },
): Promise<IngestResponse> {
  const type = (req.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  const isJson = type === "application/json";
  const fail = failure(req.contentType);

  const denied = checkIngestAuth(req, opts.tokens);
  if (denied) return denied;
  if (type !== "application/json" && type !== "application/x-protobuf") {
    return fail(415, "Unsupported content type. Send OTLP/HTTP with application/json or application/x-protobuf (gRPC isn't supported).");
  }
  if (req.body.byteLength > OTLP_MAX_BODY_BYTES) return fail(413, "Request body is too large.");

  let body = req.body;
  if ((req.contentEncoding ?? "").toLowerCase() === "gzip") {
    try {
      body = new Uint8Array(gunzipSync(body, { maxOutputLength: OTLP_MAX_BODY_BYTES + 1 }));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") return fail(413, "Request body is too large.");
      return fail(400, "The request body isn't valid gzip.");
    }
    if (body.byteLength > OTLP_MAX_BODY_BYTES) return fail(413, "Request body is too large.");
  }

  try {
    const points = isJson ? decodeOtlpJson(new TextDecoder().decode(body)) : decodeOtlpProtobuf(body);
    const batch = toTelemetryBatch(points);
    if (batch.rows.length > 0) await opts.store.add(batch, (opts.now ?? new Date()).toISOString());
  } catch (e) {
    if (e instanceof OtlpDecodeError || e instanceof CumulativeTemporalityError) return fail(400, e.message);
    throw e;
  }
  return isJson
    ? { status: 200, contentType: "application/json", body: "{}" }
    : { status: 200, contentType: "application/x-protobuf", body: new Uint8Array() };
}
