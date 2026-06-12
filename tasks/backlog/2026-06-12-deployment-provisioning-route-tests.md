# Deployment Provisioning Route-Level Behavioral Tests

**Created**: 2026-06-12
**Source**: Late-arriving test-engineer review on PR #1302 (deployment node provisioning)
**Priority**: MEDIUM

## Problem

The deployment provisioning service (`deployment-provisioning.ts`) has solid behavioral tests, but the route-level provisioning trigger in `deployment-releases.ts` (lines 248-279) lacks behavioral test coverage. The existing tests for the route use source-contract patterns (reading source as string + `toContain()`), which are banned by rule 02 for behavioral code.

## Gaps to Address

1. **Replace source-contract tests with behavioral tests** for the provisioning trigger in the release route:
   - First release to an environment without a node triggers `provisionDeploymentNode()`
   - Second release to an environment that already has a node does NOT re-provision
   - `provisionDeploymentNode` returning `null` (no credentials) still returns 201 with `nodeId: null`
   - `provisionDeploymentNode` throwing still returns 201 (error is caught and logged)

2. **Replace source-contract DNS skip test** with a spy-based behavioral test asserting `createNodeBackendDNSRecord` is not called when `deploymentContext` is set.

3. **Replace workspace-creation quota source-contract test** with a behavioral mock test.

## What Is NOT a Gap (Reviewer Errors)

- The env-to-node link update IS asserted in "links environment to node via conditional UPDATE" test
- The DNS skip IS tested behaviorally via deployment context assertion on `provisionNode`

## Acceptance Criteria

- [ ] All source-contract tests in `deployment-provisioning.test.ts` replaced with behavioral `app.request()` tests
- [ ] Route-level test covers first-release provisioning trigger
- [ ] Route-level test covers skip-provisioning-when-node-exists branch
- [ ] Route-level test covers null-return and throw paths
- [ ] DNS skip tested with spy on `createNodeBackendDNSRecord`
- [ ] All tests pass
