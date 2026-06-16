# Documentation Review

## Current State
The existing documentation structure guideline in `15-documentation-structure.md` references a mix of absolute local `file:///` paths (e.g. `[02-domain-model.md](file:///c:/Mohit/Projects/motus/docs/architecture/02-domain-model.md)`) and relative links.

---

## Findings
1.  **Portability:** Absolute `file:///` paths are tied to a specific system path (e.g., `c:/Mohit/Projects/motus/...`). Once pushed to GitHub or deployed on other developers' machines (Mac, Linux, or different Windows directories), these links break.
2.  **Web Compatibility:** Static documentation site generators (like Docusaurus, MkDocs, or GitBook) cannot parse local file system paths, causing build failures.
3.  **Local Agent Usage:** Local path schemas (such as `file:///c:/...`) are useful for IDE-integrated AI agents and local editor tooling, but they should not be written into the permanent repository documentation.

---

## Risks
*   **Broken Repository Links:** Developers viewing documentation on GitHub or GitLab will click links and receive 404 errors.
*   **Build Pipeline Failures:** Any automated lint checks for Markdown files will fail when encountering absolute Windows file paths in a Unix CI pipeline.

---

## Recommended Changes & Documentation Standards

### A. Deprecation of `file:///` Paths
*   **Rule:** Permanent repository files under `docs/` must never contain absolute `file:///` paths.
*   **Exception:** AI agents creating transient task files or logs (such as `walkthrough.md` or `task.md` inside `<appDataDir>\brain\...`) may use absolute paths to facilitate IDE navigation.

### B. Standardized Relative Links
All cross-document references in `/docs` must use standard relative paths:
*   **Same Folder Reference:**
    *   *Correct:* `[Domain Model](./02-domain-model.md)`
    *   *Incorrect:* `[Domain Model](file:///c:/Mohit/Projects/motus/docs/architecture/02-domain-model.md)`
*   **Cross-Folder Reference:**
    *   *Correct:* `[Product Overview](../product/01-product-overview.md)`
    *   *Incorrect:* `[Product Overview](file:///c:/Mohit/Projects/motus/docs/product/01-product-overview.md)`

### C. Link Verification Actions
*   A Markdown link linter (`markdown-link-check` or `tcort/markdown-link-check`) must be configured as a pre-commit hook or CI test to scan `/docs` and flag non-relative paths or broken links.

---

## Final Decision
Enforce strict relative link formatting throughout all permanent files in the `/docs` directory.

---

## Impact Analysis
*   **OSS Compatibility:** Documentation will render correctly on GitHub, GitLab, and web portals.
*   **CI Pipeline Integration:** Simplifies automated verification checks during integration runs.
