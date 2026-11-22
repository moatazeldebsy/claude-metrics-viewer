#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dashboardUrl } from "./dashboard.js";
import { registerTools } from "./tools.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const server = new McpServer({ name: "claude-metrics", version });
registerTools(server, dashboardUrl());
await server.connect(new StdioServerTransport());
