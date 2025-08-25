#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./server.js";

async function main() {
    const server = new McpServer({
        name: "mcp-gitlab-server",
        version: "0.1.0",
    });
    registerTools(server);

    // 只用 stdio；不印多餘日誌，避免干擾 stdio 通訊
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    // 若真的發生致命錯誤，寫到 stderr
    console.error("[mcp-gitlab-server] fatal:", err?.stack || err);
    process.exit(1);
});
