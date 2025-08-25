import "dotenv/config"; // 讓 process.env 可讀取 .env
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 工具：建立 commit 並 push
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
    // 註冊一個簡單的工具 (tool)，用來測試
    server.registerTool(
        "add",
        {
            title: "Addition Tool",
            description: "Add two numbers",
            inputSchema: { a: z.number(), b: z.number() },
        },
        async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }],
        })
    );

    // --- GitLab: create issue ---
    server.registerTool(
        "gitlab_create_issue",
        {
            title: "Create GitLab Issue",
            description: "在指定 GitLab 專案建立一則 Issue",
            inputSchema: {
                project: z.union([z.string(), z.number()]), // "group/repo" 或 數字ID
                title: z.string(),
                description: z.string().optional(),
                labels: z.array(z.string()).optional(),
                assigneeIds: z.array(z.number()).optional(),
                milestoneId: z.number().optional(),
                confidential: z.boolean().optional(),
                host: z.string().optional(), // 覆寫 GITLAB_HOST（選用）
                token: z.string().optional(), // 覆寫 GITLAB_TOKEN（選用）
            },
        },
        async (input: any) => {
            const host = (
                input.host ||
                process.env.GITLAB_HOST ||
                "https://gitlab.com"
            ).replace(/\/$/, "");
            const token = input.token || process.env.GITLAB_TOKEN;
            if (!token) {
                return {
                    content: [{ type: "text", text: "❌ 缺少 GITLAB_TOKEN" }],
                };
            }

            // project 可以是數字或 "group/repo"；字串要 URL encode
            const projectId =
                typeof input.project === "number"
                    ? String(input.project)
                    : encodeURIComponent(String(input.project));

            const url = `${host}/api/v4/projects/${projectId}/issues`;

            // GitLab 期望的表單欄位；labels 是逗號字串；assignee_ids[] 是多值
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
                            text: `❌ GitLab create issue 失敗：${res.status} ${text}`,
                        },
                    ],
                };
            }

            const issue = await res.json();
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Issue #${issue.iid} 建立成功：${issue.web_url}`,
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
            title: "Create/Chec kout branch",
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
                    content: [{ type: "text", text: "❌ branchName 不可為空" }],
                };
            }

            // 先確認是 git 倉庫
            const check = await runGit(
                "git rev-parse --is-inside-work-tree",
                cwd
            );
            if (!check.ok) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ 這不是 git 倉庫：${cwd}\n${check.stderr}`,
                        },
                    ],
                };
            }

            // 先抓已有分支
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
                // 已存在就 checkout
                res = await runGit(`git checkout ${branch}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ checkout 失敗：\n${res.stderr}`,
                            },
                        ],
                    };
            } else if (fromRef) {
                // 從 base ref 建分支
                res = await runGit(`git checkout -b ${branch} ${fromRef}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ 建分支失敗（from ${fromRef}）：\n${res.stderr}`,
                            },
                        ],
                    };
            } else {
                // 直接從目前 HEAD 建
                res = await runGit(`git checkout -b ${branch}`, cwd);
                if (!res.ok)
                    return {
                        content: [
                            {
                                type: "text",
                                text: `❌ 建分支失敗：\n${res.stderr}`,
                            },
                        ],
                    };
            }

            // 如果要求設 upstream，嘗試推 upstream（如果遠端不存在會建立）
            if (setUpstream !== false) {
                const push = await runGit(`git push -u origin ${branch}`, cwd);
                if (
                    !push.ok &&
                    !/set-upstream|up-to-date|Everything up-to-date/i.test(
                        push.stderr
                    )
                ) {
                    // 非致命，但把資訊回給使用者
                    return {
                        content: [
                            {
                                type: "text",
                                text: `✅ 已切到 ${branch}\n⚠️ 設定 upstream 可能失敗：\n${
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
                        text: `✅ 已切到分支：${branch}（repo: ${cwd}）`,
                    },
                ],
            };
        }
    );
}
