# Release Engineering Documentation - Motus Monorepo

This guide describes the release engineering process, version bump workflows, package publishing, rollback strategies, and troubleshooting methods for the Motus platform.

## Table of Contents
1. [Versioning Workflow](#versioning-workflow)
2. [Creating Changesets](#creating-changesets)
3. [Publishing Process](#publishing-process)
4. [Rollback Guidance](#rollback-guidance)
5. [Troubleshooting](#troubleshooting)

---

## Versioning Workflow

The Motus monorepo utilizes **Changesets** for managing package versions and changelog generation. Bumping versions consists of:
1. **Developer Contribution**: Developers add a changeset file when submitting PRs containing package modifications.
2. **Pull Request Validation**: CI verifies that pull requests touching packages contain a valid changeset.
3. **Merge to Main**: Once merged to `main`, the Release GitHub Action executes.
4. **Release PR Creation**: Changesets automatically generates a PR titled "Version Packages". This PR consumes the changesets, bumps the version fields in `package.json` files, and writes descriptions to package `CHANGELOG.md` files.
5. **Publishing**: Bumping the versions on `main` initiates package publishing to npm.

---

## Creating Changesets

Whenever you make user-facing or release-impacting changes to package code, you must include a changeset file.

### How to Create a Changeset

1. Run the changesets CLI from the root directory:
   ```bash
   npx changeset
   ```
2. **Select Packages**: Use the arrow keys and spacebar to select which packages are impacted by your changes.
3. **Determine SemVer Type**: Choose the type of version bump for each selected package:
   - `major` (breaking changes)
   - `minor` (new features, non-breaking)
   - `patch` (bug fixes, internal changes, refactorings)
4. **Enter Description**: Provide a brief, human-readable summary of the changes. This summary will automatically populate the packages' `CHANGELOG.md` files.
5. **Commit File**: A markdown file is generated under the `.changeset/` directory. Commit this file along with your changes.

---

## Publishing Process

Publishing is fully automated via GitHub Actions, but can also be triggered manually when necessary.

### Automated Publishing (CI/CD)
When the "Version Packages" PR is merged into the `main` branch:
1. The `Release` workflow is triggered.
2. The workflow verifies linting, typechecking, tests, build artifacts, and package manifests.
3. The Changesets Action executes `npm run release:publish`.
4. Since the `NPM_TOKEN` secret is configured in the action environment, the action publishes the package updates to npm.

### Local/Manual Publishing (Verification)
You can run the release and publish scripts locally:

- **Run Verification Audit**:
  ```bash
  npm run release:check
  ```
  This builds the monorepo and audits all package manifests, build outputs, export paths, and version matches.

- **Simulate/Dry-Run Publish**:
  ```bash
  npm run release:publish
  ```
  Without the `NPM_TOKEN` environment variable set, this script runs `npm publish --dry-run` inside each workspace package directory. This validates that the packaging structure is healthy and npm accepts the publishing footprint.

- **Actual Publish (Requires Auth)**:
  ```bash
  $env:NPM_TOKEN="your-npm-token"
  npm run release:publish
  ```

---

## Rollback Guidance

If an unstable or broken package version is published to npm, follow these rollback guidelines:

### 1. Deprecating the Broken Version (Preferred)
Deprecate the package version to alert users and discourage installation, without breaking existing builds:
```bash
npm deprecate @motus/core@1.0.1 "This version contains a critical bug in routing. Please upgrade to 1.0.2 or rollback to 1.0.0."
```

### 2. Unpublishing (Strict Constraints)
> [!CAUTION]
> npm only permits unpublishing within 72 hours of publication, and only if no other packages depend on it. Unpublishing is highly disruptive.
```bash
npm unpublish @motus/core@1.0.1
```

### 3. Hotfix Release (Recommended Recovery)
The safest recovery mechanism is releasing a new version:
1. Revert the problematic commit on `main`.
2. Create a patch changeset indicating the revert/fix.
3. Allow the CI/CD pipeline to version and publish the next increment (e.g. `1.0.2`), which restores the stable logic.

---

## Troubleshooting

### CI fails due to "Missing Changeset"
- **Cause**: You modified files inside the `packages/` directory, but did not include a changeset file.
- **Solution**: Run `npx changeset` locally, enter details, commit the resulting file, and push to your PR.

### CI fails on "Release Manifest and Artifact Validation"
- Check the runner logs for details. Common issues:
  - **Missing field**: Ensure `author`, `license`, `repository`, or `publishConfig` exists in package.json.
  - **Dependency version mismatch**: Ensure shared external dependencies use identical version ranges in all packages.
  - **Missing build outputs**: Ensure the package build is running successfully and compiling CJS, ESM, and Types.
  - **Invalid exports**: Ensure `main`, `module`, `types` and `exports["."]` fields exist and point to valid, built files in `dist/`.
