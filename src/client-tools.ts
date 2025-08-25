import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
async function main() {
    // use pnpm dev to start server (or change to "node", ["dist/server.js"])
    const transport = new StdioClientTransport({
        command: "mcp-gitlab-server",
        args: ["dev"],
    });

    const client = new Client({
        name: "example-client",
        version: "1.0.0",
    });

    await client.connect(transport); // will automatically do initialize/initialized handshake

    // list tools (confirm say_hello is exposed)
    const tools = await client.listTools();
    console.log("tools:", tools);

    const result = await client.callTool({
        name: "gitlab_create_issue",
        arguments: {
            project: "19", // project ID as string
            title: "MCP test Issue",
            description: "It's useing MCP server create an Issue",
            labels: ["mcp", "test"],
            assigneeIds: [], // can fill ID array
            confidential: false,
        },
    });
    console.log("issue reply:", result);

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
    console.log("issue reply:", commitResult);

    await client.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
