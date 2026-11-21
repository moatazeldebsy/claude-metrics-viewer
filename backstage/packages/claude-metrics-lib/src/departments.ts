import { readFileSync } from "node:fs";

/**
 * Parse an `email,department` CSV (header optional) into a lowercase-email → department map.
 * Export one from your HR system or IdP; the Console Admin API has no team concept.
 */
export function parseDepartmentsCsv(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const [email, ...rest] = line.split(",");
    const dept = rest.join(",").trim().replace(/^"|"$/g, "");
    if (!email?.includes("@") || !dept) continue; // skips header and blank lines
    map.set(email.trim().toLowerCase(), dept);
  }
  return map;
}

export function loadDepartmentsFile(path: string | undefined): Map<string, string> {
  return path ? parseDepartmentsCsv(readFileSync(path, "utf8")) : new Map();
}
