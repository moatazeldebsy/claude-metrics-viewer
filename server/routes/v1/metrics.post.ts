// OTLP/HTTP metrics endpoint for Claude Code: OTEL_EXPORTER_OTLP_ENDPOINT=<this app's origin>.
import { getTelemetryStore } from "#lib/sources";
import { handleOtlpIngest, OTLP_MAX_BODY_BYTES } from "#lib/telemetry/ingest";

export default defineEventHandler(async (event) => {
  const tokens = (process.env.OTEL_INGEST_TOKENS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const store = getTelemetryStore();
  if (process.env.DATA_SOURCE !== "otel" || !store) {
    setResponseStatus(event, 404);
    return { message: "OTLP ingest is only available with DATA_SOURCE=otel." };
  }
  const declared = Number(getHeader(event, "content-length") ?? 0);
  if (declared > OTLP_MAX_BODY_BYTES * 2) {
    setResponseStatus(event, 413);
    return { message: "Request body is too large." };
  }
  const body = (await readRawBody(event, false)) ?? Buffer.alloc(0);
  const res = await handleOtlpIngest(
    {
      body: new Uint8Array(body),
      contentType: getHeader(event, "content-type"),
      contentEncoding: getHeader(event, "content-encoding"),
      authorization: getHeader(event, "authorization"),
    },
    { tokens, store },
  );
  setResponseStatus(event, res.status);
  setResponseHeader(event, "content-type", res.contentType);
  return typeof res.body === "string" ? res.body : Buffer.from(res.body);
});
