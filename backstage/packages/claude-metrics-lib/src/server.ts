// Node entry point: data sources (Anthropic Admin API or the seeded mock org), filter parsing
// and the service functions behind every dashboard route. Settings come from env vars:
// DATA_SOURCE, ANTHROPIC_ADMIN_KEY, DEPARTMENTS_FILE, HOLIDAY_COUNTRY.
export * from './index';
export { holidayCountry, holidaysFor } from './holidays';
export { MAX_RANGE_DAYS, parseQuery, QueryError, selectedDays } from './query';
export {
  claudeCodeSummary,
  costSummary,
  COST_DIMENSIONS,
  departmentList,
  departmentSummary,
  seatSummary,
  userSearch,
  usersPage,
} from './service';
export {
  dataSourceName,
  getSource,
  getTelemetryStore,
  registerTelemetryStore,
  sourceCapabilities,
  telemetryStatus,
} from './sources';
export { OtelSource } from './sources/otel';
export {
  decodeOtlpJson,
  decodeOtlpProtobuf,
  OtlpDecodeError,
  type AttrValue,
  type OtlpPoint,
} from './telemetry/otlp';
export {
  CumulativeTemporalityError,
  TELEMETRY_COUNTERS,
  toTelemetryBatch,
  type TelemetryBatch,
  type TelemetryCounter,
  type TelemetryKey,
  type TelemetryRow,
  type TelemetryUser,
} from './telemetry/rows';
export { MemoryTelemetryStore, type TelemetryStore } from './telemetry/store';
export {
  handleOtlpIngest,
  OTLP_MAX_BODY_BYTES,
  type IngestRequest,
  type IngestResponse,
} from './telemetry/ingest';
