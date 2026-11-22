import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { handleOtlpIngest, OTLP_MAX_BODY_BYTES, type IngestRequest } from "#lib/telemetry/ingest";
import { MemoryTelemetryStore } from "#lib/telemetry/store";

const json = new Uint8Array(readFileSync("tests/fixtures/otlp/claude-code-metrics.json"));
const pb = new Uint8Array(readFileSync("tests/fixtures/otlp/claude-code-metrics.pb"));
const req = (over: Partial<IngestRequest> = {}): IngestRequest => ({
  body: json,
  contentType: "application/json",
  contentEncoding: undefined,
  authorization: "Bearer tok",
  ...over,
});
const sessions = async (store: MemoryTelemetryStore) =>
  (await store.records("2026-11-22")).reduce((s, r) => s + (r.counters.sessions ?? 0), 0);
const text = (body: Uint8Array | string) => (typeof body === "string" ? body : new TextDecoder().decode(body));

describe("handleOtlpIngest", () => {
  it("returns 503 when no tokens are configured, and stores nothing", async () => {
    const store = new MemoryTelemetryStore();
    const res = await handleOtlpIngest(req(), { tokens: [], store });
    expect(res.status).toBe(503);
    expect(text(res.body)).toContain("OTLP ingest is disabled: no ingest tokens are configured.");
    expect(await store.lastReceivedAt()).toBeNull();
  });

  it("returns 401 without a token or with a wrong one", async () => {
    const store = new MemoryTelemetryStore();
    expect((await handleOtlpIngest(req({ authorization: undefined }), { tokens: ["tok"], store })).status).toBe(401);
    expect((await handleOtlpIngest(req({ authorization: "Bearer nope" }), { tokens: ["tok"], store })).status).toBe(401);
    expect(await store.lastReceivedAt()).toBeNull();
  });

  it("accepts a bearer prefix in any case", async () => {
    const store = new MemoryTelemetryStore();
    expect((await handleOtlpIngest(req({ authorization: "bearer tok" }), { tokens: ["tok"], store })).status).toBe(200);
    expect((await handleOtlpIngest(req({ authorization: "BEARER tok" }), { tokens: ["tok"], store })).status).toBe(200);
  });

  it("accepts either of two configured tokens", async () => {
    const store = new MemoryTelemetryStore();
    expect((await handleOtlpIngest(req({ authorization: "Bearer b" }), { tokens: ["a", "b"], store })).status).toBe(200);
  });

  it("stores the JSON fixture and answers 200 {}", async () => {
    const store = new MemoryTelemetryStore();
    const res = await handleOtlpIngest(req(), { tokens: ["tok"], store, now: new Date("2026-11-22T12:00:00Z") });
    expect(res).toMatchObject({ status: 200, contentType: "application/json" });
    expect(text(res.body)).toBe("{}");
    expect(await sessions(store)).toBe(1);
    expect(await store.lastReceivedAt()).toBe("2026-11-22T12:00:00.000Z");
  });

  it("stores the protobuf fixture and answers 200 with an empty body", async () => {
    const store = new MemoryTelemetryStore();
    const res = await handleOtlpIngest(req({ body: pb, contentType: "application/x-protobuf" }), { tokens: ["tok"], store });
    expect(res).toMatchObject({ status: 200, contentType: "application/x-protobuf" });
    expect(text(res.body)).toBe("");
    expect((await store.users()).map((u) => u.actor)).toEqual(["ada.lovela@example.test"]);
  });

  it("accepts gzip-encoded bodies", async () => {
    const store = new MemoryTelemetryStore();
    const res = await handleOtlpIngest(req({ body: gzipSync(json), contentEncoding: "gzip" }), { tokens: ["tok"], store });
    expect(res.status).toBe(200);
    expect(await sessions(store)).toBe(1);
  });

  it("returns 413 above the size limit, including after gunzip", async () => {
    const store = new MemoryTelemetryStore();
    const big = new Uint8Array(OTLP_MAX_BODY_BYTES + 1);
    expect((await handleOtlpIngest(req({ body: big }), { tokens: ["tok"], store })).status).toBe(413);
    expect((await handleOtlpIngest(req({ body: gzipSync(big), contentEncoding: "gzip" }), { tokens: ["tok"], store })).status).toBe(413);
  });

  it("returns 415 for gRPC and unknown content types", async () => {
    const store = new MemoryTelemetryStore();
    expect((await handleOtlpIngest(req({ contentType: "application/grpc" }), { tokens: ["tok"], store })).status).toBe(415);
    expect((await handleOtlpIngest(req({ contentType: "text/plain" }), { tokens: ["tok"], store })).status).toBe(415);
  });

  it("returns 400 for an undecodable body", async () => {
    const store = new MemoryTelemetryStore();
    expect((await handleOtlpIngest(req({ body: new TextEncoder().encode("{oops") }), { tokens: ["tok"], store })).status).toBe(400);
  });

  it("returns 400 with the cumulative message", async () => {
    const store = new MemoryTelemetryStore();
    const cumulative = new TextEncoder().encode(text(json).replace(/"aggregationTemporality": 1/g, '"aggregationTemporality": 2'));
    const res = await handleOtlpIngest(req({ body: cumulative }), { tokens: ["tok"], store });
    expect(res.status).toBe(400);
    expect(text(res.body)).toContain("Cumulative temporality isn't supported.");
  });

  it("answers 200 and stores nothing for an empty batch or one with only other metrics", async () => {
    const store = new MemoryTelemetryStore();
    const empty = new TextEncoder().encode("{}");
    const other = new TextEncoder().encode(JSON.stringify({ resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: "http.server.duration", sum: { aggregationTemporality: 1, dataPoints: [{ timeUnixNano: "1", asInt: "1" }] } }] }] }] }));
    expect((await handleOtlpIngest(req({ body: empty }), { tokens: ["tok"], store })).status).toBe(200);
    expect((await handleOtlpIngest(req({ body: other }), { tokens: ["tok"], store })).status).toBe(200);
    expect(await store.users()).toEqual([]);
    expect(await store.lastReceivedAt()).toBeNull();
  });
});
