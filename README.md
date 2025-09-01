# GitLab MCP Server

An **MCP server** that provides Git workflow automation and GitLab integration for AI assistants.
https://www.npmjs.com/package/@evalin8/mcp-gitlab-server

## Features

-   **Git Operations**: Create branches, commit changes, and push via git CLI
-   **GitLab Integration**: Create issues via GitLab REST API
-   **Automated Workflow**: Streamline development workflow with AI assistance
-   **Flexible Configuration**: Support for GitLab.com and self-hosted instances

> **Transport**: stdio  
> **Runtime**: Node.js 18+

## Installation

### Using NPX (Recommended)

```bash
npx @evalin8/mcp-gitlab-server
```

### Global Installation

```bash
npm install -g @evalin8/mcp-gitlab-server
# or: pnpm add -g @evalin8/mcp-gitlab-server
```

### Local Installation

```bash
npm install @evalin8/mcp-gitlab-server
npx @evalin8/mcp-gitlab-server
```

## Setup

### GitLab Personal Access Token

1. Go to GitLab → **Settings** → **Access Tokens**
2. Create a new token with these scopes:
    - `api` - Full API access
    - `read_user` - Read user information
    - `read_repository` - Read repository content
3. Copy the token (starts with `glpat_`)

### Environment Configuration

Create a `.env` file in your project root or set environment variables:

```bash
GITLAB_HOST=https://gitlab.com/api/v4
GITLAB_TOKEN=glpat_xxxxxxxxxxxxxxxxx
```

> **Note**: `GITLAB_HOST` should include the full API path ending with `/api/v4`. For self-hosted GitLab, use `https://your-gitlab.company.com/api/v4`.

### MCP Client Integration

Add the following configuration to your MCP client:

#### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Cursor/VSCode/Other MCP Clients

Add to your MCP settings configuration

```json
{
    "mcpServers": {
        "gitlab": {
            "command": "npx",
            "args": ["-y", "@evalin8/mcp-gitlab-server"],
            "env": {
                "GITLAB_HOST": "https://gitlab.com/api/v4",
                "GITLAB_TOKEN": "glpat_your_token_here"
            }
        }
    }
}
```

**Note**: Restart your MCP client after saving the configuration.

## Available Tools

### Git Operations

#### `git_create_branch`

Create and checkout a new branch

-   `repoPath`: string (optional; defaults to current directory)
-   `branchName`: string (required)
-   `fromRef`: string (optional; e.g., "origin/main")
-   `setUpstream`: boolean (optional; default: true)

#### `git_commit_push`

Commit all changes and push to branch

-   `repoPath`: string (required)
-   `message`: string (required)
-   `branch`: string (required)

### GitLab Operations

#### `gitlab_create_issue`

Create a new issue in GitLab project

-   `project`: string (required; numeric ID recommended)
-   `title`: string (required)
-   `description`: string (optional)
-   `labels`: string[] (optional)
-   `assigneeIds`: number[] (optional)
-   `milestoneId`: number (optional)
-   `confidential`: boolean (optional)

## Getting Project ID

To find your GitLab project ID:

1. Go to your GitLab project page
2. The numeric ID is displayed under the project name
3. Use this numeric ID (e.g., `12345`) not the project path

## Example Usage

```typescript
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";

async function example() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@evalin8/mcp-gitlab-server"],
    });
    const client = new McpClient(transport);
    await client.connect();

    // Create a feature branch
    await client.callTool("git_create_branch", {
        repoPath: "/path/to/repo",
        branchName: "feat/ai-integration",
        fromRef: "origin/main",
    });

    // Make changes, then commit and push
    await client.callTool("git_commit_push", {
        repoPath: "/path/to/repo",
        message: "feat: add AI integration",
        branch: "feat/ai-integration",
    });

    // Create a GitLab issue
    await client.callTool("gitlab_create_issue", {
        project: "12345",
        title: "Review AI integration feature",
        description: "Please review the new AI integration implementation",
    });

    await client.close();
}
```

## Troubleshooting

### GitLab API Issues

-   **404 Error**: Ensure `GITLAB_HOST` includes the full API path (e.g., `https://gitlab.com/api/v4`) and use numeric project ID
-   **401 Error**: Verify your token has `api` scope and is correctly set
-   **403 Error**: Check if you have sufficient permissions for the project

### Git Operations

-   **Push hangs**: Set `setUpstream: false` or configure Git credentials/SSH
-   **Authentication required**: This server sets `GIT_TERMINAL_PROMPT=0` to avoid interactive prompts

### General Issues

-   **Server not responding**: Check that the server process is running
-   **Environment variables**: Ensure `.env` file is in the correct location
-   **Node.js version**: Requires Node.js 18 or higher

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Watch Mode

```bash
npm run start
```

## Environment Variables

-   `GITLAB_HOST`: GitLab API URL including `/api/v4` path (e.g., `https://gitlab.com/api/v4` or `https://gitlab.company.com/api/v4`) - defaults to `https://gitlab.com/api/v4`
-   `GITLAB_TOKEN`: Your GitLab personal access token (required)

---

## License

MIT License - Copyright (c) 2025 Eva

This MCP server is licensed under the MIT License. Feel free to use, modify, and distribute according to the license terms.
