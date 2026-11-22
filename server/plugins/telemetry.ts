// DATA_SOURCE=otel: open the telemetry database, register it as the data source's store, and prune
// rows older than TELEMETRY_RETENTION_DAYS (default 400; 0 keeps everything) at startup and daily.
import { addDays, toDay } from "#lib/dates";
import { registerTelemetryStore } from "#lib/sources";
import { SqliteTelemetryStore } from "../utils/sqlite-telemetry-store";

export default defineNitroPlugin(() => {
  if (process.env.DATA_SOURCE !== "otel") return;
  const store = new SqliteTelemetryStore(process.env.TELEMETRY_DB || "./.data/telemetry.db");
  registerTelemetryStore(store);

  const retentionDays = Number(process.env.TELEMETRY_RETENTION_DAYS ?? 400);
  if (!(retentionDays > 0)) return;
  const prune = () => store.prune(addDays(toDay(new Date()), -retentionDays)).catch((e) => console.error("telemetry prune failed", e));
  void prune();
  setInterval(prune, 24 * 60 * 60 * 1000).unref();
});
