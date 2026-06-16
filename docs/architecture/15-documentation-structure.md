# 15 - Documentation Structure

This document defines the final documentation hierarchy for Motus. It outlines the directories, naming conventions, cross-linking rules, and maintenance processes.

---

## Directory Hierarchy

All project documentation resides in the `docs/` folder, structured by category:

```
docs/
├── product/             # Product Specifications (Approved V1 Specs)
│   ├── 01-product-overview.md
│   ├── 02-driver-lifecycle.md
│   ├── ...
│   └── 15-roadmap.md
├── architecture/        # System Design & Core Architectures
│   ├── 01-system-overview.md
│   ├── 02-domain-model.md
│   ├── ...
│   └── 15-documentation-structure.md
├── guides/              # Integration & Configuration Guides
│   ├── getting-started.md
│   └── custom-matching-guide.md
├── reference/           # SDK Signatures & API Contracts
│   ├── sdk-reference.md
│   └── rest-api-reference.md
└── deployment/          # Infrastructural Deployments (Docker, K8s)
    ├── local-compose.md
    └── kubernetes-setup.md
```

---

## Technical Details

### 1. Document Category Guidelines

#### A. `/docs/product/`
*   **Purpose:** Houses product requirements, user workflows, state transition matrices, and domain lifecycle rules.
*   **Audience:** Product managers, business analysts, and developers seeking functional context.
*   **Rule:** Approved and finalized specification sheets. Infrastructure assumptions are excluded from this directory.

#### B. `/docs/architecture/`
*   **Purpose:** Details technical implementation paths, package boundaries, data schemas, scaling vectors, and system designs.
*   **Audience:** Architects, principal engineers, and platform maintainers.
*   **Rule:** Must include technical topologies, trade-offs, and Mermaid structure diagrams.

#### C. `/docs/guides/`
*   **Purpose:** Step-by-step developer tutorials (e.g. configuring a tenant, writing a custom matching filter).
*   **Audience:** Application developers integrating with Motus.

#### D. `/docs/reference/`
*   **Purpose:** Technical API specifications (OpenAPI files, JSDoc summaries, SDK parameter indexes).
*   **Audience:** Engineers writing client integration code.

#### E. `/docs/deployment/`
*   **Purpose:** DevOps instructions covering Redis Cluster configurations, HAProxy sticky balance parameters, and Helm values.
*   **Audience:** Infrastructure developers and site reliability engineers.

### 2. Cross-Linking Conventions
To ensure all documentation remains browsable, links must follow standardized conventions:
*   **Local Absolute Scheme:** Use the `file:///` scheme with absolute paths using forward slashes for Windows compatibility when documenting internal files:
    *   Example: `[02-domain-model.md](file:///c:/Mohit/Projects/motus/docs/architecture/02-domain-model.md)`
*   **GitHub Relative Layouts:** Relative links are used for version control hosting:
    *   Example: `[Domain Models](../architecture/02-domain-model.md)`

---

## Failure Scenarios

*   **Dead Links (Configuration Drift):** If files are renamed without updating references, documentation links break. To prevent this, include a Markdown link validation tool (e.g., `markdown-link-check`) in the CI/CD pipeline to test all links on commit.

---

## Tradeoffs

*   **Unified Repo vs Decentralized Docs:** Storing documentation directly in the monorepo alongside source code ensures that changes to code and API features can be submitted in the same PR as documentation updates. The trade-off is that it increases repository size, which is accepted as the benefits of synchronized documentation outweigh the storage cost.

---

## Future Considerations

*   **Static Documentation Site:** Automating static HTML generation (using tools like Docusaurus or MkDocs) from the `/docs` directory during release phases, hosting a public searchable documentation portal.
