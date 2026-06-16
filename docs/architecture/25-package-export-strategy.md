# 25 - Package Export Strategy

This document establishes the packaging standards, module export maps, type resolution configurations, and API encapsulation guidelines for all published Motus packages.

---

## Purpose
This document defines how Motus packages export their APIs. It details the configuration of the `package.json` `exports` field to support both ESM and CommonJS resolving, manage subpaths, and enforce API encapsulation.

---

## Goals
*   **Enforce API Encapsulation:** Prevent consumer applications from importing internal packages files directly.
*   **Support Dual Resolving:** Enable runtime environments to resolve ESM or CommonJS format bundles automatically.
*   **Resolve Type Definitions:** Ensure compiler tools can locate and resolve package type definitions under both ESM and CJS formats.
*   **Define Clear Entrypoints:** Expose distinct subpath exports (such as testing utility helpers) separate from the package root.

---

## Scope
This strategy applies to the `package.json` configurations of all packages under `/packages` and apps under `/apps`.

---

## Design Decisions

### 1. Package Resolving Topology
The following diagram illustrates how the `exports` block in `package.json` resolves compiler and execution lookups:

```mermaid
graph TD
    Consumer["Consumer import / require"] --> PackageJSON["package.json 'exports' Map"]
    
    PackageJSON -->|import '@motus/core'| ESMFile["dist/index.js\n(ES Modules execution)"]
    PackageJSON -->|require '@motus/core'| CJSFile["dist/index.cjs\n(CommonJS execution)"]
    PackageJSON -->|TS compile check| DTSFile["dist/index.d.ts\n(Type definitions)"]
    
    PackageJSON -->|import '@motus/core/testing'| TestESM["dist/testing.js\n(Testing helpers module)"]
    PackageJSON -->|require '@motus/core/testing'| TestCJS["dist/testing.cjs\n(Testing CJS helper)"]
    PackageJSON -->|TS compile testing| TestDTS["dist/testing.d.ts\n(Testing typings)"]
    
    Consumer -.->|import private source path| Blocked["Blocked by Node.js\n(ERR_PACKAGE_PATH_NOT_EXPORTED)"]
```

### 2. The Standard `exports` Field
All Motus packages utilize the modern `exports` configuration in `package.json` rather than relying solely on the legacy `"main"` property.
*   **Encapsulation Boundary:** Node.js blocks imports that attempt to resolve paths not explicitly declared in the `exports` block. This prevents consumer applications from building dependencies on internal files (e.g. `import { helper } from '@motus/core/dist/utils/internal.js'`), allowing developers to refactor internal helpers without breaking compatibility.

### 3. Dual ESM/CJS Export Syntax
To support dual module resolution, each export target defines specific conditions:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```
*   **Condition Ordering:** The `"types"` key must always reside as the first field inside the export mapping. This is required by TypeScript to resolve typings correctly prior to processing the JavaScript execution pathways.
*   **`import` vs `require`:** Node.js resolves to `"import"` when the consumer code utilizes standard `import` syntax, and falls back to `"require"` when the consumer code executes inside a `require()` CommonJS script.

### 4. Subpath Exports
For packages that bundle utilities that are not required for standard runtimes (such as testing mocks, custom filters, or CLI tools), subpath exports are exposed:
```json
"exports": {
  ".": { ... },
  "./testing": {
    "types": "./dist/testing.d.ts",
    "import": "./dist/testing.js",
    "require": "./dist/testing.cjs"
  }
}
```
This isolates testing weight from standard runtime imports, keeping bundle footprints small for typical deployments.

### 5. Deprecation Policy
*   **Lifecycle Warnings:** Deprecated public APIs are annotated with the JSDoc `@deprecated` tag and trigger compilation warnings during development.
*   **Compatibility Window:** Deprecated APIs are maintained for at least one major release lifecycle before being removed, allowing consumers time to migrate.

---

## Alternatives Considered

### 1. Legacy Single Entrypoint Configuration
*   **Approach:** Declare `"main": "dist/index.js"` and `"types": "dist/index.d.ts"` inside `package.json` without an `exports` block.
*   **Why Rejected:** This structure does not natively support dual module configurations, leading to errors in CommonJS Node.js projects. It also exposes the entire internal filesystem to imports, which breaks API isolation.

### 2. Exporting Pure TS Source Files
*   **Approach:** Direct consumers to compile raw TS files located inside `src/`.
*   **Why Rejected:** This forces consumer compilation configurations to conform exactly to Motus standards, causing version conflicts in tsconfig targets, dependencies, and build pipelines.

---

## Tradeoffs

*   **Syntax Complexity:** The package configuration boilerplate is larger. Every folder path exposed to the public must be explicitly maintained in the `exports` configuration.
*   **Strict Resolution Paths:** Developers cannot quickly test local file additions in downstream packages without adding them to the package export configuration. This is accepted to maintain clean, isolated APIs.

---

## Recommended Standards

### 1. Standard package `package.json` Configuration
This template defines the baseline metadata, exports, and types structures for a workspace package:
```json
{
  "name": "@motus/core",
  "version": "1.0.0",
  "description": "Pure domain state and matching logic for Motus",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.js",
      "require": "./dist/testing.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "clean": "rimraf dist"
  }
}
```

---

## Risks
*   **Type Resolution Failures:** Incorrectly ordered keys in the `exports` block (e.g. placing `import` before `types`) can cause TypeScript compiler errors. This is managed by enforcing strict ordering templates.
*   **Subpath Resolution Drift:** Adding new files that need to be exposed as subpaths without updating `package.json` will block consumer access. This risk is addressed by code reviews that check the public API surface area.

---

## Future Considerations
*   **Export Integrity Checking:** Integrating `@arethetypeswrong/cli` into the CI validation pipeline to automatically check that dual package exports resolve correctly across format conditions.
