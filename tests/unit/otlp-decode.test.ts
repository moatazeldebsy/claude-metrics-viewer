import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeOtlpJson, decodeOtlpProtobuf, OtlpDecodeError, type OtlpPoint } from "#lib/telemetry/otlp";

const json = readFileSync("tests/fixtures/otlp/claude-code-metrics.json", "utf8");
const pb = new Uint8Array(readFileSync("tests/fixtures/otlp/claude-code-metrics.pb"));

const totals = (points: OtlpPoint[]) =>
  points.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.metric]: (acc[p.metric] ?? 0) + p.value }), {});

const sumRequest = (temporality: unknown, value: Record<string, unknown> = { asInt: "3" }) =>
  JSON.stringify({
    resourceMetrics: [{
      resource: { attributes: [{ key: "department", value: { stringValue: "Data" } }] },
      scopeMetrics: [{ metrics: [{ name: "claude_code.commit.count", sum: { aggregationTemporality: temporality, dataPoints: [{ timeUnixNano: "1795392000000000000", attributes: [], ...value }] } }] }],
    }],
  });

describe("decodeOtlpJson", () => {
  it("decodes the JSON fixture", () => {
    const points = decodeOtlpJson(json);
    const session = points.find((p) => p.metric === "claude_code.session.count")!;
    expect(session).toMatchObject({ kind: "sum", temporality: "delta", value: 1 });
    expect(typeof session.attributes["session.id"]).toBe("string");
    expect(session.resource["service.name"]).toBe("claude-code");
    const tokens = points.filter((p) => p.metric === "claude_code.token.usage");
    expect(tokens.length).toBe(4);
    for (const t of tokens) {
      expect(["input", "output", "cacheRead", "cacheCreation"]).toContain(t.attributes.type);
      expect(typeof t.attributes.model).toBe("string");
    }
    expect(totals(points)["claude_code.cost.usage"]).toBeCloseTo(0.2046018, 7);
  });

  it("maps JSON enum names and numbers to delta", () => {
    expect(decodeOtlpJson(sumRequest(1))[0]!.temporality).toBe("delta");
    expect(decodeOtlpJson(sumRequest("AGGREGATION_TEMPORALITY_DELTA"))[0]!.temporality).toBe("delta");
    expect(decodeOtlpJson(sumRequest(2))[0]!.temporality).toBe("cumulative");
  });

  it("turns int64 strings and asDouble values into numbers", () => {
    expect(decodeOtlpJson(sumRequest(1, { asInt: "3" }))[0]!.value).toBe(3);
    expect(decodeOtlpJson(sumRequest(1, { asDouble: 2.5 }))[0]!.value).toBe(2.5);
    expect(decodeOtlpJson(sumRequest(1))[0]!.timeUnixNano).toBe(1795392000000000000n);
  });

  it("throws OtlpDecodeError on invalid JSON", () => {
    expect(() => decodeOtlpJson("{not json")).toThrow(OtlpDecodeError);
  });
});

describe("decodeOtlpProtobuf", () => {
  it("decodes the protobuf fixture to the same metric names as the JSON one", () => {
    const fromPb = totals(decodeOtlpProtobuf(pb));
    const fromJson = totals(decodeOtlpJson(json));
    expect(Object.keys(fromPb).sort()).toEqual(Object.keys(fromJson).sort());
    for (const v of Object.values(fromPb)) expect(v).toBeGreaterThan(0);
  });

  it("keeps attributes, temporality and timestamps", () => {
    const points = decodeOtlpProtobuf(pb);
    const tokens = points.filter((p) => p.metric === "claude_code.token.usage");
    expect(tokens.map((t) => t.attributes.type).sort()).toEqual(["cacheCreation", "cacheRead", "input", "output"]);
    expect(points.every((p) => p.temporality === "delta" && p.kind === "sum")).toBe(true);
    expect(points[0]!.attributes["user.email"]).toBe("ada.lovela@example.test");
    expect(points[0]!.timeUnixNano).toBeGreaterThan(1_700_000_000_000_000_000n);
  });

  it("throws OtlpDecodeError on malformed bytes", () => {
    expect(() => decodeOtlpProtobuf(new Uint8Array([0x0a, 0xff, 0xff, 0xff, 0xff, 0x0f, 0x01]))).toThrow(OtlpDecodeError);
  });
});
