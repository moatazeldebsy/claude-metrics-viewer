// OTLP/HTTP metrics endpoint for Claude Code: OTEL_EXPORTER_OTLP_ENDPOINT=<this app's origin>.
import { getTelemetryStore } from "#lib/sources";
import { checkIngestAuth, handleOtlpIngest, OTLP_MAX_BODY_BYTES, readBodyCapped } from "#lib/telemetry/ingest";

export default defineEventHandler(async (event) => {
  const tokens = (process.env.OTEL_INGEST_TOKENS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const store = getTelemetryStore();
  if (process.env.DATA_SOURCE !== "otel" || !store) {
    setResponseStatus(event, 404);
    return { message: "OTLP ingest is only available with DATA_SOURCE=otel." };
  }
  // Check the token from the headers first, then read at most the size limit: an unauthenticated
  // or oversized (including chunked) request is never buffered.
  const denied = checkIngestAuth({ contentType: getHeader(event, "content-type"), authorization: getHeader(event, "authorization") }, tokens);
  if (denied) {
    setResponseStatus(event, denied.status);
    setResponseHeader(event, "content-type", denied.contentType);
    return denied.body;
  }
  const body = await readBodyCapped(event.node.req, OTLP_MAX_BODY_BYTES);
  if (!body) {
    setResponseStatus(event, 413);
    return { message: "Request body is too large." };
  }
  const res = await handleOtlpIngest(
    {
      body,
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
