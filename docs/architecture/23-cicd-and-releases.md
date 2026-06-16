# 23 - CI/CD & Releases

This document designs the Continuous Integration, Continuous Delivery, security auditing, and automated release pipeline configurations for Motus.

---

## Goals
*   **Automated Quality Gates:** Guard the main branch by running automated build, lint, typecheck, and test checks on every pull request.
*   **Continuous Vulnerability Scans:** Scan dependency chains and codebase patterns for security flaws on a regular schedule.
*   **Frictionless Package Releases:** Automate versioning, changelog compilation, and npm publishing upon merge.
*   **Fast Execution Loops:** Optimize pipeline execution times using shared cache layers for package managers and build compilers.

---

## CI/CD Pipeline Lifecycles

The CI/CD flow is divided into PR Validation pipelines (triggered on review loops) and Release pipelines (triggered on branch merges):

```mermaid
flowchart TD
    subgraph PRValidation [PR Validation Pipeline (Triggers: Pull Requests to main)]
        PRTrigger[Developer opens PR] --> Checkout[Checkout Code]
        Checkout --> SetupPNPM[Setup Node.js & PNPM Store Cache]
        SetupPNPM --> ParallelChecks{Parallel Verification}
        
        ParallelChecks --> Lint["Lint & Format\n(pnpm lint)"]
        ParallelChecks --> TypeCheck["Type Check\n(pnpm typecheck)"]
        ParallelChecks --> Test["Test Suite\n(pnpm test:cov)"]
        ParallelChecks --> Build["Verify Build\n(pnpm build)"]
        
        Lint & TypeCheck & Test & Build --> PRStatus[Update PR Check Status]
    end

    subgraph ReleaseCycle [Release & Deploy Pipeline (Triggers: Merge to main)]
        MergeTrigger[Merge PR to main] --> LoadChangesets[Changesets Parse]
        LoadChangesets --> BuildAll[Build Packages & Images]
        BuildAll --> TestAll[Run Full Integration Suites]
        TestAll --> ReleaseBranch{Changeset Check}
        
        ReleaseBranch -->|Pending Changesets| CreatePR["Create 'Version Packages' PR\n(Bumps versions, adds changelogs)"]
        ReleaseBranch -->|Publish Tag Merged| PublishNPM["Publish packages to NPM"]
        PublishNPM --> PublishDocker["Build & Push Server Docker Image"]
    end
```

---

## Design Decisions

### 1. GitHub Actions Workflows
Motus uses **GitHub Actions** as its primary automation server.
*   **Workspace Optimization:** Pipeline actions leverage `pnpm/action-setup` to configure store directories, saving up to 60% of checkout execution times compared to standard dependency fetches.
*   **Fast Cache Keys:** Cache keys are tied to the checksums of `pnpm-lock.yaml`, ensuring node dependencies are cached across runs unless the lockfile changes.

### 2. Pull Request Gatekeeping
Before code can be merged into `main`, the branch protection rules require:
*   A green status check from the PR Validation workflow.
*   A code review approval from a repository maintainer.
*   A validation check verifying that a Changeset description file exists if code modifications are made inside `/packages`.

### 3. Automated Release Loop with Changesets Action
When a PR merges to `main`, the Changesets compiler checks for markdown changes in the `.changeset/` folder:
*   **PR Generation Phase:** If changesets exist, the workflow creates or updates a permanent pull request named `"Version Packages"`. This PR updates the target versions of each package in their `package.json` files, runs compilation checks, and adds changelogs.
*   **Release Execution Phase:** Once a maintainer merges the `"Version Packages"` PR, the workflow runs `changeset publish`, which uploads packages to npm, pushes git tags, and creates GitHub releases.

### 4. Dependency and Code Security Auditing
The codebase runs automated scanning workflows:
*   **Security Auditing (`audit-ci`):** Scans dependencies for known CVEs. Vulnerability checks are run with high severity warnings, blocking builds if critical security flaws are detected.
*   **CodeQL Code Scanning:** Runs static analysis on Javascript/TypeScript patterns to detect structural vulnerabilities (such as SQL injections or unhandled regex engines).
*   **Renovate Bot:** Automatically opens PRs to upgrade stale dependencies on a weekly schedule.

---

## Alternatives Considered

### 1. GitLab CI / Jenkins
*   **Approach:** Run build checks on a private Jenkins server or GitLab CI pipeline.
*   **Why Rejected:** Motus is hosted on GitHub. Using GitHub Actions eliminates the overhead of provisioning, maintaining, and securing third-party build nodes, while integrating directly into the pull request user interface.

### 2. Automated Git-Tag Triggers (Conventional Commits)
*   **Approach:** Generate version tags on every merge to main automatically using git history parse tools.
*   **Why Rejected:** In a monorepo, a commit might target `@motus/redis` without affecting `@motus/types`. Conventional commit-based release frameworks often bump every package concurrently or require complex regex logic to calculate monorepo changes. Changesets put control in developers' hands, minimizing version inflation.

---

## Tradeoffs

*   **Changeset Friction:** Developers must create changesets locally (`pnpm changeset`) when making package changes. While it adds a manual step, this is necessary to ensure clear changelog descriptions.

---

## Future Considerations

*   **Multi-Platform Docker Builds:** Extending the Docker build step to support multi-architecture outputs (`linux/amd64` and `linux/arm64`) using GitHub's Buildx action.
*   **Canary / Nightly Releases:** Automating nightly pre-release builds (e.g. `@motus/core@next`) to allow early testing of features before stable version bumps.

---

## Recommended Standards

### 1. The `pr-validation.yml` Workflow Template
This file is created under `.github/workflows/pr-validation.yml`:
```yaml
name: PR Validation

on:
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup PNPM
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Get PNPM Store Directory
        id: pnpm-cache
        run: |
          echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Cache PNPM Store
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint & Format Checks
        run: pnpm lint

      - name: Type Check
        run: pnpm typecheck

      - name: Run Tests with Coverage
        run: pnpm test --coverage

      - name: Run Build
        run: pnpm build
```

### 2. Branch Protection Requirements
*   **Target Branch:** `main`
*   **Rule:** Require status checks to pass before merging (`validate` job status).
*   **Rule:** Require signed commits.
*   **Rule:** Require pull request reviews before merging.
