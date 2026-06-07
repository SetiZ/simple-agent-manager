# Cache getUserInstallationRepositories on the spawn hot path

## Problem

The fail-fast user∩app repo-access gate (`requireRepositoryUserAccess`, shipped in PR #1244)
calls `getUserInstallationRepositories` on every workspace create, task submit, and task run.
That service (`apps/api/src/services/github-app.ts:442–490`) paginates the GitHub installation
repositories list with `perPage=100` in a `while (hasMore)` loop with no caching and no
short-circuit — it always fetches every page even when the bound repo appears early.

For installations with many repos this adds latency directly on the task-execution critical
path before any node provisioning starts:
- ~1 page / 100 repos: +200–400ms
- ~5 pages / 500 repos: +1–2s

The security requirement (re-verify the user still has access at spawn) is sound and must stay.
The latency comes from the uncached, unbounded pagination, which pre-existed on the
infrequent project create/update paths but is now on the frequent spawn paths.

## Context

- Discovered by the cloudflare-specialist review of PR #1244 (idea `01KTFG04QBD8N34A7V00PGKYJZ`).
- Two MEDIUM findings, both pre-existing (not introduced by #1244):
  1. Unbounded sequential GitHub pagination, no caching (this task).
  2. `tasks/run.ts` fetches the project row twice (`requireOwnedProject` at line 68 discards its
     result, then re-selects the same row at lines 133–142). Capturing the first result and
     passing it to `requireRepositoryUserAccess` would remove one D1 round-trip. (Bundle here or
     split — small.)

## Acceptance Criteria

- [ ] Add KV-backed caching to `getUserInstallationRepositories` for the `project-access` flow
      with a short TTL (~60s). A minute-old cache is sufficient for the "was this user removed
      from the org?" security signal; spawn paths do not need GitHub-real-time freshness.
- [ ] Cache key is scoped per (userId, installationId) so it cannot leak another user's
      visibility. TTL is env-overridable (no hardcoded constant — Constitution Principle XI).
- [ ] Gate behavior unchanged: revoked access still 403s once the cache expires; githubRepoId
      drift still 403s.
- [ ] `tasks/run.ts`: eliminate the duplicate project SELECT by reusing the `requireOwnedProject`
      result (optional — split if preferred).
- [ ] Behavioral test: second spawn within the TTL window does NOT re-issue the GitHub
      pagination call (assert call count), and a spawn after TTL expiry DOES re-verify.
- [ ] Staging verification: submit two tasks back-to-back on a github-backed project, confirm
      the second skips the GitHub list call (logs) and still provisions.

## References

- PR #1244 (merge commit a0218b4d) — fail-fast spawn gate
- `apps/api/src/services/github-app.ts:442` — `getUserInstallationRepositories`
- `apps/api/src/routes/projects/_helpers.ts` — `requireRepositoryUserAccess`, `assertRepositoryAccess`
- `.claude/rules/32-cf-api-debugging.md` — KV access for cache state
- `.claude/rules/03-constitution.md` — Principle XI (no hardcoded TTL)
