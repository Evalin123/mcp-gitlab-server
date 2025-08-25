# mcp-gitlab-server

An **MCP server** that provides:

-   Git tools via **git CLI**: create/checkout branch, commit & push.
-   GitLab tool: create issue via GitLab REST API.

> Transport: **stdio** (fixed).  
> Runtime: **Node.js 18+**.

## Install

Global:

```bash
pnpm add -g mcp-gitlab-server
# or: npm i -g mcp-gitlab-server
```

Project local (CLI via npx):

```
pnpm add mcp-gitlab-server
npx mcp-gitlab-server
```

## Environment

Create .env or set env vars:

```
GITLAB_HOST=https://gitlab.com
GITLAB_TOKEN=glpat_xxxxxxxxxxxxxxxxx
```
> For self-hosted GitLab, GITLAB_HOST is the base URL.

## Usage
As a CLI (stdio)

```
mcp-gitlab-server
# waits for an MCP client over stdio

```

Example client (TypeScript)

```
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";

async function main() {
  const transport = new StdioClientTransport({ command: "mcp-gitlab-server" });
  const client = new McpClient(transport);
  await client.connect();

  console.log(await client.listTools());

  // 1) Create branch
  await client.callTool("git_create_branch", {
    repoPath: "/abs/path/to/repo",
    branchName: "feat/mcp-demo",
    fromRef: "origin/main",
    setUpstream: false
  });

  // 2) Commit & push
  await client.callTool("git_commit_push", {
    repoPath: "/abs/path/to/repo",
    message: "chore: demo",
    branch: "feat/mcp-demo"
  });

  // 3) Create GitLab issue (use numeric project ID)
  await client.callTool("gitlab_create_issue", {
    project: 12345,
    title: "MCP-created issue",
    description: "Hello from mcp-gitlab-server"
  });

  await client.close();
}
main();
```

Claude Desktop config (example)

```
{
  "mcpServers": {
    "gitlab": {
      "command": "mcp-gitlab-server",
      "env": {
        "GITLAB_HOST": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat_xxx"
      }
    }
  }
}
```

Tools

```git_create_branch```

-   repoPath: string (optional; default: server CWD)

-   branchName: string (required)

-   fromRef: string (optional; e.g. origin/main)

-   setUpstream: boolean (default: true — if auth not set, consider false)

```git_commit_push```

-   repoPath: string (required)

-   message: string (required)

-   branch: string (required)

```gitlab_create_issue```

-   project: number | string (required; numeric ID recommended)

-   title: string (required)

-   description: string

-   labels: string[]

-   assigneeIds: number[]

-   milestoneId: number

-   confidential: boolean

## Troubleshooting

-   404 from GitLab: ensure GITLAB_HOST is base URL (no /api/v4), use numeric project ID, and token has api scope.

-   git push hangs: set setUpstream: false, or configure credentials/SSH; this server sets GIT_TERMINAL_PROMPT=0 to avoid interactive prompts.

-   stdio logging: server prints nothing to stdout (reserved for JSON-RPC). Logs go to stderr on fatal errors only.

---

## MIT License

Copyright (c) 2025 Eva

Permission is hereby granted, free of charge, to any person obtaining a copy
