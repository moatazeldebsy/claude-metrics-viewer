// Decode OTLP/HTTP metric export requests (ExportMetricsServiceRequest) as JSON or protobuf into
// flat data points. Only what the dashboard needs is read: Sum and Gauge number data points with
// their attributes and the resource attributes. Histograms and summaries come back as kind "other".

export type AttrValue = string | number | boolean;

export interface OtlpPoint {
  metric: string;
  kind: 'sum' | 'gauge' | 'other';
  temporality: 'delta' | 'cumulative' | 'unspecified';
  timeUnixNano: bigint;
  value: number;
  attributes: Record<string, AttrValue>;
  resource: Record<string, AttrValue>;
}

export class OtlpDecodeError extends Error {}

const TEMPORALITY: Record<string, OtlpPoint['temporality']> = {
  '0': 'unspecified',
  '1': 'delta',
  '2': 'cumulative',
  AGGREGATION_TEMPORALITY_UNSPECIFIED: 'unspecified',
  AGGREGATION_TEMPORALITY_DELTA: 'delta',
  AGGREGATION_TEMPORALITY_CUMULATIVE: 'cumulative',
};

// ── JSON ──────────────────────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>;

function jsonValue(v: unknown): AttrValue | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as JsonObject;
  if (typeof o.stringValue === 'string') return o.stringValue;
  if (typeof o.boolValue === 'boolean') return o.boolValue;
  if (o.intValue !== undefined) return Number(o.intValue);
  if (o.doubleValue !== undefined) return Number(o.doubleValue);
  return undefined;
}

function jsonAttributes(list: unknown): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {};
  if (!Array.isArray(list)) return out;
  for (const kv of list as JsonObject[]) {
    const value = jsonValue(kv?.value);
    if (typeof kv?.key === 'string' && value !== undefined) out[kv.key] = value;
  }
  return out;
}

export function decodeOtlpJson(text: string): OtlpPoint[] {
  let req: JsonObject;
  try {
    req = JSON.parse(text) as JsonObject;
  } catch {
    throw new OtlpDecodeError("The request body isn't valid OTLP JSON.");
  }
  const points: OtlpPoint[] = [];
  for (const rm of (req.resourceMetrics as JsonObject[] | undefined) ?? []) {
    const resource = jsonAttributes(
      (rm.resource as JsonObject | undefined)?.attributes,
    );
    for (const sm of (rm.scopeMetrics as JsonObject[] | undefined) ?? []) {
      for (const m of (sm.metrics as JsonObject[] | undefined) ?? []) {
        const data = (m.sum ?? m.gauge) as JsonObject | undefined;
        const kind: OtlpPoint['kind'] = m.sum
          ? 'sum'
          : m.gauge
          ? 'gauge'
          : 'other';
        if (!data) continue;
        const temporality =
          kind === 'sum'
            ? TEMPORALITY[String(data.aggregationTemporality ?? 0)] ??
              'unspecified'
            : 'unspecified';
        for (const dp of (data.dataPoints as JsonObject[] | undefined) ?? []) {
          points.push({
            metric: String(m.name ?? ''),
            kind,
            temporality,
            timeUnixNano: BigInt(String(dp.timeUnixNano ?? '0')),
            value: Number(dp.asDouble ?? dp.asInt ?? 0),
            attributes: jsonAttributes(dp.attributes),
            resource,
          });
        }
      }
    }
  }
  return points;
}

// ── Protobuf ──────────────────────────────────────────────────────────────────

class Reader {
  pos = 0;
  constructor(readonly buf: Uint8Array, readonly end = buf.length) {}
  get done() {
    return this.pos >= this.end;
  }
  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.end)
        throw new OtlpDecodeError('Truncated protobuf varint.');
      const b = this.buf[this.pos++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += 7n;
    }
    throw new OtlpDecodeError('Malformed protobuf varint.');
  }
  fixed64(): DataView {
    if (this.pos + 8 > this.end)
      throw new OtlpDecodeError('Truncated protobuf fixed64.');
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      8,
    );
    this.pos += 8;
    return view;
  }
  sub(): Reader {
    const len = Number(this.varint());
    if (len < 0 || this.pos + len > this.end)
      throw new OtlpDecodeError(
        'Protobuf length runs past the end of the message.',
      );
    const r = new Reader(this.buf, this.pos + len);
    r.pos = this.pos;
    this.pos += len;
    return r;
  }
  string(): string {
    const r = this.sub();
    return new TextDecoder().decode(this.buf.subarray(r.pos, r.end));
  }
  skip(wireType: number) {
    if (wireType === 0) this.varint();
    else if (wireType === 1) this.fixed64();
    else if (wireType === 2) this.sub();
    else if (wireType === 5) {
      if (this.pos + 4 > this.end)
        throw new OtlpDecodeError('Truncated protobuf fixed32.');
      this.pos += 4;
    } else
      throw new OtlpDecodeError(`Unsupported protobuf wire type ${wireType}.`);
  }
  /** Iterate fields: calls fn(fieldNumber, wireType); fn must consume the value or return false to skip it. */
  fields(fn: (field: number, wireType: number) => boolean) {
    while (!this.done) {
      const tag = Number(this.varint());
      const field = tag >>> 3;
      const wireType = tag & 7;
      if (field === 0)
        throw new OtlpDecodeError('Invalid protobuf field number 0.');
      if (!fn(field, wireType)) this.skip(wireType);
    }
  }
}

function pbAnyValue(r: Reader): AttrValue | undefined {
  let value: AttrValue | undefined;
  r.fields((f, w) => {
    if (f === 1 && w === 2) value = r.string();
    else if (f === 2 && w === 0) value = r.varint() !== 0n;
    else if (f === 3 && w === 0) value = Number(BigInt.asIntN(64, r.varint()));
    else if (f === 4 && w === 1) value = r.fixed64().getFloat64(0, true);
    else return false;
    return true;
  });
  return value;
}

function pbKeyValue(r: Reader, into: Record<string, AttrValue>) {
  let key: string | undefined;
  let value: AttrValue | undefined;
  r.fields((f, w) => {
    if (f === 1 && w === 2) key = r.string();
    else if (f === 2 && w === 2) value = pbAnyValue(r.sub());
    else return false;
    return true;
  });
  if (key !== undefined && value !== undefined) into[key] = value;
}

interface PbDataPoint {
  timeUnixNano: bigint;
  value: number;
  attributes: Record<string, AttrValue>;
}

function pbNumberDataPoint(r: Reader): PbDataPoint {
  const dp: PbDataPoint = { timeUnixNano: 0n, value: 0, attributes: {} };
  r.fields((f, w) => {
    if (f === 3 && w === 1) dp.timeUnixNano = r.fixed64().getBigUint64(0, true);
    else if (f === 4 && w === 1) dp.value = r.fixed64().getFloat64(0, true);
    else if (f === 6 && w === 1)
      dp.value = Number(r.fixed64().getBigInt64(0, true));
    else if (f === 7 && w === 2) pbKeyValue(r.sub(), dp.attributes);
    else return false;
    return true;
  });
  return dp;
}

function pbMetric(
  r: Reader,
  resource: Record<string, AttrValue>,
  out: OtlpPoint[],
) {
  let name = '';
  let kind: OtlpPoint['kind'] = 'other';
  let temporality: OtlpPoint['temporality'] = 'unspecified';
  const dataPoints: PbDataPoint[] = [];
  const readData = (data: Reader, isSum: boolean) =>
    data.fields((f, w) => {
      if (f === 1 && w === 2) dataPoints.push(pbNumberDataPoint(data.sub()));
      else if (isSum && f === 2 && w === 0)
        temporality = TEMPORALITY[String(data.varint())] ?? 'unspecified';
      else return false;
      return true;
    });
  r.fields((f, w) => {
    if (f === 1 && w === 2) name = r.string();
    else if (f === 5 && w === 2) {
      kind = 'gauge';
      readData(r.sub(), false);
    } else if (f === 7 && w === 2) {
      kind = 'sum';
      readData(r.sub(), true);
    } else return false;
    return true;
  });
  for (const dp of dataPoints)
    out.push({ metric: name, kind, temporality, ...dp, resource });
}

export function decodeOtlpProtobuf(bytes: Uint8Array): OtlpPoint[] {
  const out: OtlpPoint[] = [];
  const root = new Reader(bytes);
  root.fields((f, w) => {
    if (f !== 1 || w !== 2) return false;
    const rm = root.sub();
    const resource: Record<string, AttrValue> = {};
    const metricReaders: Reader[] = [];
    rm.fields((rf, rw) => {
      if (rf === 1 && rw === 2) {
        const res = rm.sub();
        res.fields((af, aw) =>
          af === 1 && aw === 2
            ? (pbKeyValue(res.sub(), resource), true)
            : false,
        );
      } else if (rf === 2 && rw === 2) {
        const sm = rm.sub();
        sm.fields((sf, sw) =>
          sf === 2 && sw === 2 ? (metricReaders.push(sm.sub()), true) : false,
        );
      } else return false;
      return true;
    });
    // Resource may follow scope_metrics on the wire, so metrics are read once the resource is known.
    for (const m of metricReaders) pbMetric(m, resource, out);
    return true;
  });
  return out;
}
