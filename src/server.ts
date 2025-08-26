import "dotenv/config"; // 讓 process.env 可讀取 .env
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// tools: create commit and push
async function gitCommitPush(
    repoPath: string,
    message: string,
    branch: string
) {
    // 確保目錄存在
    const options = { cwd: repoPath };

    // 加入檔案
    await execAsync("git add .", options);

    // 建立 commit
    await execAsync(
        `git commit -m "${message}" || echo "No changes to commit"`,
        options
    );

    // 推送到遠端
    await execAsync(`git push origin ${branch}`, options);

    return `✅ Commit & push 完成 (${branch})`;
}

async function runGit(cmd: string, cwd: string) {
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd });
        return { ok: true as const, stdout, stderr };
    } catch (e: any) {
        return {
            ok: false as const,
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? e.message ?? String(e),
        };
    }
}

export function registerTools(server: McpServer) {
    // --- GitLab: create issue ---
    server.registerTool(
        "gitlab_create_issue",
        {
            title: "Create GitLab Issue",
            description: "Create an issue in the specified GitLab project",
            inputSchema: {
                project: z.string(), // "group/repo" or ID as string
                title: z.string(),
                description: z.string().optional(),
                labels: z.array(z.string()).optional(),
                assigneeIds: z.array(z.number()).optional(),
                milestoneId: z.number().optional(),
                confidential: z.boolean().optional(),
                host: z.string().optional(), // override GITLAB_HOST (optional)
                token: z.string().optional(), // override GITLAB_TOKEN (optional)
            },
        },
        async (input: any) => {
            const host = (
                input.host ||
                process.env.GITLAB_HOST ||
                "https://gitlab.com/api/v4"
            ).replace(/\/$/, "");
            const token = input.token || process.env.GITLAB_TOKEN;
            if (!token) {
                return {
                    content: [
                        { type: "text", text: "❌ missing GITLAB_TOKEN" },
                    ],
                };
            }

            // project is always string now; if it's a numeric string, use as-is; if it contains special chars, URL encode
            const projectId = /^\d+$/.test(input.project)
                ? input.project
                : encodeURIComponent(input.project);

            const url = `${host}/projects/${projectId}/issues`;

            // GitLab expected form fields; labels is comma-separated; assignee_ids[] is multi-value
            const body = new URLSearchParams();
            body.set("title", input.title);
            if (input.description) body.set("description", input.description);
            if (Array.isArray(input.labels) && input.labels.length)
                body.set("labels", input.labels.join(","));
            if (Array.isArray(input.assigneeIds))
                input.assigneeIds.forEach((id: number) =>
                    body.append("assignee_ids[]", String(id))
                );
            if (typeof input.milestoneId === "number")
                body.set("milestone_id", String(input.milestoneId));
            if (typeof input.confidential === "boolean")
                body.set("confidential", String(input.confidential));

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "PRIVATE-TOKEN": token,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });

            if (!res.ok) {
                const text = await res.text();
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ GitLab create issue failed: ${res.status} ${text}`,
                        },
                    ],
                };
            }

            const issue = await res.json();
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Issue #${issue.iid} created successfully: ${issue.web_url}`,
                    },
                ],
            };
        }
    );

    // --- Git: commit & push ---
    server.registerTool(
        "git_commit_push",
        {
            title: "Git Commit Message",
            description: "Commit all changes and push to a branch",
            inputSchema: {
                repoPath: z.string(),
                message: z.string(),
                branch: z.string(),
            },
        },
        async ({ repoPath, message, branch }) => {
            const result = await gitCommitPush(repoPath, message, branch);
            return { content: [{ type: "text", text: result }] };
        }
    );

    // --- Git: create & checkout local branch (via git CLI) ---
    server.registerTool(
        "git_create_branch",
        {
            title: "Create/Checkout branch",
            description: "Create a new branch and checkout to it",
            inputSchema: {
                repoPath: z.string().optional(),
                branchName: z.string(),
                fromRef: z.string().optional(),
                setUpstream: z.boolean().optional().default(true),
            },
        },
        async ({ repoPath, branchName, fromRef, setUpstream }) => {
            const cwd = repoPath || process.cwd();
            const branch = String(branchName).trim();
            if (!branch) {
                return {
                    content: [
                        { type: "text", text: "❌ branchName cannot be empty" },
                    ],
                };
            }

            // check if it is a git repository
            const check = await runGit(
                "git rev-parse --is-inside-work-tree",
                cwd
            );
            if (!check.ok) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ this is not a git repository: ${cwd}\n${check.stderr}`,
                        },
                    ],
                };
            }

            // get existing branches
            const list = await runGit(
                "git branch --list --format='%(refname:short)'",
                cwd
            );
            const exists =
                list.ok &&
                list.stdout &&
                list.stdout
                    .split("\n")
                    .map((s: string) => s.replace(/['\r]/g, "").trim())
                    .includes(branch);

            let res;
            if (exists) {
                // if exists, checkout
                res = await runGit(`git checkout ${branch}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ checkout failed: \n${res.stderr}`,
                            },
                        ],
                    };
            } else if (fromRef) {
                // create branch from base ref
                res = await runGit(`git checkout -b ${branch} ${fromRef}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ create branch failed (from ${fromRef}): \n${res.stderr}`,
                            },
                        ],
                    };
            } else {
                // create branch from current HEAD
                res = await runGit(`git checkout -b ${branch}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ create branch failed: \n${res.stderr}`,
                            },
                        ],
                    };
            }

            // if setUpstream is true, try to push to upstream (if remote does not exist, it will be created)
            if (setUpstream !== false) {
                const push = await runGit(`git push -u origin ${branch}`, cwd);
                if (
                    !push.ok &&
                    !/set-upstream|up-to-date|Everything up-to-date/i.test(
                        push.stderr
                    )
                ) {
                    // not fatal, but inform the user
                    return {
                        content: [
                            {
                                type: "text",
                                text: `✅ checked out to ${branch}\n⚠️ setting upstream may fail: \n${
                                    push.stderr || push.stdout
                                }`,
                            },
                        ],
                    };
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ checked out to ${branch} (repo: ${cwd})`,
                    },
                ],
            };
        }
    );
}
