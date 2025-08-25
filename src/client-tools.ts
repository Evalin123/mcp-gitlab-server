// 若升級後仍沒有這些路徑，告訴我；我們再用備案。
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
async function main() {
    // 用 pnpm dev 啟 server（或改成 "node", ["dist/server.js"]）
    const transport = new StdioClientTransport({
        command: "mcp-gitlab-server",
        args: ["dev"],
    });

    const client = new Client({
        name: "example-client",
        version: "1.0.0",
    });

    await client.connect(transport); // 會自動做 initialize/initialized 握手

    // 列出工具（確認 say_hello 有被暴露）
    const tools = await client.listTools();
    console.log("工具清單：", tools);

    const result = await client.callTool({
        name: "gitlab_create_issue",
        arguments: {
            project: 19, // 或數字ID
            title: "MCP test Issue",
            description: "It's useing MCP server create an Issue",
            labels: ["mcp", "test"],
            assigneeIds: [], // 可填 ID 陣列
            confidential: false,
        },
    });
    console.log("issue 回覆：", result);

    const resBranch = await client.callTool({
        name: "git_create_branch",
        arguments: {
            repoPath: "/Users/eva/Documents/GitLab/customcaptive",
            message: "fix: update login flow",
            branchName: "test-mcp2",
            setUpstream: false,
        },
    });
    console.log("git_create_branch:", resBranch);

    const commitResult = await client.callTool({
        name: "git_commit_push",
        arguments: {
            repoPath: "/Users/eva/Documents/GitLab/customcaptive",
            message: "fix: update login flow",
            branch: "test-mcp",
        },
    });
    console.log("issue 回覆：", commitResult);

    await client.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
