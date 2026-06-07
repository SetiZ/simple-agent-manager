# Harden GitHub Token Injection

## Problem

Workspace GitHub tokens must only be minted when the final control-plane boundary can prove the workspace owner still has current GitHub user access through the app installation, the repository still matches the stored repository identity, and the applicable SAM platform policy permits the requested token permissions. Existing preflight checks help normal spawn paths, but the runtime mint endpoint can still trust stale create-time access, generated credential helpers expose a durable workspace callback token, and some task runner paths drop profile policy context.

This is security-sensitive credential work and must fail closed. The PR is **DO NOT MERGE**: create a draft or clearly marked PR and stop after staging evidence.

## Research Findings

- Source idea `01KTHTZSJDHSJ7EG6SHS3PW6GQ` identifies the final mint endpoint `apps/api/src/routes/workspaces/runtime.ts` as the hard authorization boundary.
- Prior idea `01KTFG04QBD8N34A7V00PGKYJZ` established user/app intersection via `assertRepositoryAccess()` and `getUserInstallationRepositories()`, and found missing spawn preflight gates.
- Prior idea `01KTFA36XHHPXAC4EE03SG4FHT` clarified that installation owner row-scope is necessary but insufficient; live user/app repository access is the substantive control.
- Relevant files from the idea:
  - `apps/api/src/routes/workspaces/runtime.ts`
  - `apps/api/src/routes/projects/_helpers.ts`
  - `apps/api/src/services/github-user-access-token.ts`
  - `apps/api/src/services/github-app.ts`
  - `apps/api/src/services/github-cli-policy.ts`
  - `packages/vm-agent/internal/bootstrap/bootstrap.go`
  - `packages/vm-agent/internal/server/git_credential.go`
  - `packages/vm-agent/internal/acp/session_host_startup.go`
  - `apps/api/src/routes/workspaces/lifecycle.ts`
  - `apps/api/src/routes/mcp/dispatch-tool.ts`
  - `apps/api/src/durable-objects/sam-session/tools/dispatch-task.ts`
  - `apps/api/src/services/trigger-submit.ts`
  - `apps/api/src/scheduled/cron-triggers.ts`
  - `apps/api/src/services/github-trigger-handler.ts`
  - `apps/api/src/routes/workspaces/agent-sessions.ts`
  - `apps/api/src/durable-objects/sam-session/tools/retry-subtask.ts`
  - `apps/api/src/routes/mcp/orchestration-tools.ts`
  - `apps/api/src/durable-objects/project-orchestrator/scheduling.ts`
  - `apps/api/src/routes/tasks/run.ts`
- Rules read:
  - `.claude/rules/14-do-workflow-persistence.md`
  - `.claude/rules/34-vm-agent-callback-auth.md`
  - `.claude/rules/13-staging-verification.md`
  - `.claude/rules/35-vertical-slice-testing.md`
  - `.claude/rules/28-credential-resolution-fallback-tests.md`
  - `.claude/rules/02-quality-gates.md`
- Project knowledge: GitHub hardening must preserve same-org submodule clone/fetch/update support. Do not use broad sentinel app-token minting for platform-hosted/zero-config behavior.

## Implementation Checklist

- [ ] Add or reuse a callback-safe final verifier for GitHub-backed workspaces that checks workspace callback auth, workspace owner, installation owner, current user OAuth token, user/app repository visibility, exact repository name, repo ID drift, and platform policy before minting.
- [ ] Update `/api/workspaces/:id/git-token` to deny with 403 before `getInstallationToken()` when user OAuth token is missing/revoked, repo is not visible, installation is inaccessible, repo ID drift occurs, policy is malformed, or profile policy denies the request.
- [ ] Preserve non-GitHub and Artifacts behavior explicitly; document the platform-hosted/public-repo behavior without broad sentinel minting.
- [ ] Remove durable workspace callback-token literals from generated git credential helpers, preferring VM-agent-local token exchange.
- [ ] Reduce static `GH_TOKEN` exposure by relying on hardened on-demand git/gh token retrieval and ensuring ACP startup fetches a fresh scoped token instead of preferring stale env-file tokens.
- [ ] Add defense-in-depth user/app preflight gates for workspace restart/rebuild, MCP dispatch, SAM-session dispatch, trigger/cron/webhook task submission, and direct agent-session start where GitHub token mint/push can occur.
- [ ] Fix profile policy propagation in retry, MCP orchestration replacement, project orchestrator scheduling, and tasks run paths.
- [ ] Add behavioral tests for all required positive and negative `/git-token` cases, including no `getInstallationToken()` call on denials.
- [ ] Add behavioral tests for custom `githubCliPolicy`, malformed stored policy fail-closed, preflight gates, profile propagation, helper script token redaction, ACP fresh token fetching, and existing clone/git/gh flows.
- [ ] Add a post-mortem/process-fix update for this credential-boundary bug class.
- [ ] Run relevant local quality gates, full validation, and specialist reviews.
- [ ] Deploy to staging only via GitHub Actions `deploy-staging.yml`.
- [ ] Verify staging GitHub-backed project with custom GitHub CLI policy: provisioning, clone, `git fetch`, safe `git push` if possible, and `gh repo view`.
- [ ] Verify safe diagnostics show repo-scoped and permission-narrowed token options without raw token values.
- [ ] Verify denied/revoked-access behavior in staging or a bounded staging-like integration substitute and document why the substitute proves the path.
- [ ] Open a draft or clearly marked **DO NOT MERGE** PR with exact staging evidence and residual risks.

## Acceptance Criteria

- No GitHub token is minted for a workspace unless the workspace owner currently has user/app access to the exact repository and profile policy permits it.
- GitHub-backed tokens are single-repository scoped.
- Custom `githubCliPolicy` survives every TaskRunner-starting path and narrows token permissions at mint time.
- Generated credential helpers do not contain durable workspace callback tokens.
- ACP, shell, git, and gh paths continue to work with fresh scoped credentials.
- Required tests pass locally and in CI.
- Staging verification is complete and documented in the PR.
- PR remains draft or clearly marked **DO NOT MERGE**. It is not marked ready and not merged.

## Post-Mortem Draft

- What broke: runtime token minting could trust stale authorization and helper scripts exposed a renewable callback capability.
- Root cause: final credential mint boundary lacked live user/app access verification and reusable control-plane bearer tokens were materialized into workspace-readable files.
- Why not caught: prior checks focused on project creation and normal spawn preflight paths, not the runtime callback mint boundary and credential helper content.
- Class of bug: credential trust-boundary drift across asynchronous provisioning/runtime paths.
- Process fix target: strengthen agent guidance or reviewer checklist for final credential mint boundaries and generated helper artifacts.
