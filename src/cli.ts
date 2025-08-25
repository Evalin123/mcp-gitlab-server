#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./server.js";

async function main() {
    const server = new McpServer({
        name: "mcp-gitlab-server",
        version: "1.0.2",
    });
    registerTools(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error("[mcp-gitlab-server] fatal:", err?.stack || err);
    process.exit(1);
});
