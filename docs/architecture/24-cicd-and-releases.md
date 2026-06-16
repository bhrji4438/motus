# 24 - CI/CD & Releases

This document designs the Continuous Integration, Continuous Delivery, security auditing, dependency scanning, and release orchestration pipelines for Motus.

---

## Purpose
This document establishes the CI/CD architecture for the Motus project. It outlines the workflows, verification checks, and automated release pipelines required to build, test, and distribute Motus packages.

---

## Goals
*   **Enforce Build Quality:** Run lint, format, typecheck, and test checks on every pull request to protect the `main` branch.
*   **Automate Releases:** Automate semantic versioning updates, changelog generation, and npm publishing on release merges.
*   **Secure the Build Pipeline:** Scan dependencies and codebase patterns for vulnerabilities on a continuous schedule.
*   **Optimize CI Speed:** Optimize checkout and cache layers in GitHub Actions to minimize test execution latency.

---

## Scope
This strategy applies to all GitHub Actions workflows, repository branch protection policies, security scanners, and npm package publishing pipelines.

---

## Design Decisions

### 1. CI/CD Pipeline Lifecycles

The CI/CD workflow is divided into PR Validation pipelines (triggered on review loops) and Release pipelines (triggered on branch merges):

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

### 2. GitHub Actions Workflows
Motus standardizes on **GitHub Actions** as its primary CI/CD platform.
*   **Caching Strategy:** Workflows leverage `pnpm/action-setup` to cache store directories, reducing installation times by up to 60%.
*   **Parallel Execution:** Quality checks (linting, typechecking, and testing) run as parallel jobs to reduce the time from PR submission to review feedback.

### 3. Branch Protection Requirements
To ensure code quality, the `main` branch enforces the following protection rules:
*   Require status checks to pass before merging (specifically the PR validation workflow).
*   Require pull request reviews before merging.
*   Require signed commits.
*   Require a changeset configuration file when code in `/packages` is modified.

### 4. Dependency and Security Scanning
*   **Security Auditing (`audit-ci`):** Dependency checks are run on every build to block changes that introduce critical vulnerabilities (CVEs).
*   **CodeQL Code Scanning:** GitHub's CodeQL runs static analysis on commits to detect common structural vulnerabilities (such as SQL injections or unhandled regex engines).
*   **Renovate Bot:** Automatically opens PRs to upgrade stale dependencies on a weekly schedule.

---

## Alternatives Considered

### 1. GitLab CI / Jenkins
*   **Approach:** Maintain a private Jenkins build server or use GitLab CI pipelines.
*   **Why Rejected:** Motus is hosted on GitHub. Using GitHub Actions eliminates the overhead of provisioning, maintaining, and securing third-party build nodes, while integrating directly into the pull request user interface.

### 2. Automated Git-Tag Triggers (Conventional Commits)
*   **Approach:** Generate version tags on every merge to main automatically using git history parse tools.
*   **Why Rejected:** In a monorepo, a commit might target `@motus/redis` without affecting `@motus/types`. Conventional commit-based release frameworks often bump every package concurrently or require complex regex logic to calculate monorepo changes. Changesets put control in developers' hands, minimizing version inflation.

---

## Tradeoffs

*   **Changeset Discipline:** Developers must create changesets locally (`pnpm changeset`) when making package changes. While it adds a manual step, this is necessary to ensure clear changelog descriptions.

---

## Recommended Standards

### 1. The `pr-validation.yml` Workflow Template
This template defines the validation pipeline for pull requests:
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

---

## Risks
*   **NPM Token Compromise:** Storing long-lived npm publishing tokens in GitHub Secrets introduces security risks. This is mitigated by configuring GitHub OIDC (OpenID Connect) to authenticate publishing requests without static tokens.
*   **CI Pipeline Bottlenecks:** Large integration test suites can increase pipeline wait times. This risk is addressed by utilizing parallel test runners and Turborepo compilation caches.

---

## Future Considerations
*   **Multi-Platform Container Builds:** Extending the Docker build step to support multi-architecture outputs (`linux/amd64` and `linux/arm64`) using GitHub's Buildx action.
*   **Canary Deployments:** Automating nightly pre-release builds (e.g. `@motus/core@next`) to allow early testing of features before stable version bumps.
