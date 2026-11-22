// Dev tool: record OTLP/HTTP request bodies, e.g. from Claude Code, to build test fixtures.
//   node scripts/capture-otlp.mjs <port> <outDir>
// Answers every POST with 200 {} and saves <n>.json or <n>.pb plus <n>.meta.json (path, headers).
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [port = "4318", outDir = "otlp-capture"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
let n = 0;

createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const type = req.headers["content-type"] ?? "";
    const ext = type.includes("json") ? "json" : "pb";
    n += 1;
    writeFileSync(join(outDir, `${n}.${ext}`), Buffer.concat(chunks));
    writeFileSync(join(outDir, `${n}.meta.json`), JSON.stringify({ url: req.url, headers: req.headers }, null, 2));
    console.log(`#${n} ${req.method} ${req.url} ${type} ${Buffer.concat(chunks).length} bytes`);
    res.writeHead(200, { "content-type": type.includes("json") ? "application/json" : "application/x-protobuf" });
    res.end(type.includes("json") ? "{}" : "");
  });
}).listen(Number(port), () => console.log(`capturing on :${port} → ${outDir}`));
