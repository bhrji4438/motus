const fs = require("fs");
const path = require("path");

const packagesDir = path.resolve(__dirname, "../packages");
const packages = fs.readdirSync(packagesDir);

let failed = false;

function error(message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  failed = true;
}

function info(message) {
  console.log(`\x1b[32m[INFO]\x1b[0m ${message}`);
}

// 1. Collect all packages and dependency versions
const packageDataList = [];
const allDeps = {}; // name -> { version: string, packages: string[] }

for (const pkg of packages) {
  const pkgPath = path.join(packagesDir, pkg);
  if (!fs.statSync(pkgPath).isDirectory()) continue;

  const pkgJsonPath = path.join(pkgPath, "package.json");
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  packageDataList.push({ name: pkgJson.name, dir: pkgPath, json: pkgJson });

  // Record dependencies for mismatch check
  const checkDeps = (deps) => {
    if (!deps) return;
    for (const [depName, depVer] of Object.entries(deps)) {
      // Exclude workspace packages using "*" or "workspace:*" or similar
      if (depVer === "*" || depVer.startsWith("workspace:")) continue;
      if (!allDeps[depName]) {
        allDeps[depName] = [];
      }
      allDeps[depName].push({ pkg: pkgJson.name, ver: depVer });
    }
  };

  checkDeps(pkgJson.dependencies);
  checkDeps(pkgJson.devDependencies);
  checkDeps(pkgJson.peerDependencies);
}

// 2. Audit Dependency Version Mismatches
info("Auditing dependency version consistency...");
for (const [depName, occurrences] of Object.entries(allDeps)) {
  const versions = [...new Set(occurrences.map((o) => o.ver))];
  if (versions.length > 1) {
    const list = occurrences.map((o) => `  - ${o.pkg}: ${o.ver}`).join("\n");
    error(`Dependency version mismatch for "${depName}":\n${list}`);
  }
}

// 3. Audit Package Manifests, Build Configs, and exports files
for (const { name, dir, json } of packageDataList) {
  info(`Auditing package: ${name}...`);

  // Manifest fields
  const requiredFields = [
    "name",
    "version",
    "license",
    "repository",
    "author",
    "main",
    "module",
    "types",
    "exports",
    "publishConfig",
  ];
  for (const field of requiredFields) {
    if (!json[field]) {
      error(`Package "${name}" is missing required field "${field}".`);
    }
  }

  if (json.license && json.license !== "MIT") {
    error(
      `Package "${name}" license should be "MIT". Found: "${json.license}"`
    );
  }

  if (json.author && json.author !== "Mohit Gupta <bhrji.4438@gmail.com>") {
    error(
      `Package "${name}" author should be "Mohit Gupta <bhrji.4438@gmail.com>". Found: "${json.author}"`
    );
  }

  if (json.publishConfig && json.publishConfig.access !== "public") {
    error(
      `Package "${name}" publishConfig.access should be "public". Found: "${json.publishConfig.access}"`
    );
  }

  // Repository Check
  if (json.repository) {
    const repoUrl =
      typeof json.repository === "string"
        ? json.repository
        : json.repository.url;
    if (!repoUrl || !repoUrl.includes("github.com/bhrji4438/motus")) {
      error(
        `Package "${name}" repository URL is invalid or mismatched: "${repoUrl}"`
      );
    }
  }

  // Build Configuration Audit
  // Determine build system
  const buildScript = json.scripts && json.scripts.build;
  if (!buildScript) {
    error(`Package "${name}" does not have a "build" script.`);
  } else {
    if (buildScript.includes("tsup")) {
      // Check if tsup is configured to produce ESM, CJS and declarations
      const tsupConfigPath = path.join(dir, "tsup.config.ts");
      if (fs.existsSync(tsupConfigPath)) {
        const configContent = fs.readFileSync(tsupConfigPath, "utf8");
        const hasCjs = configContent.includes("cjs");
        const hasEsm = configContent.includes("esm");
        const hasDts = configContent.includes("dts");
        if (!hasCjs || !hasEsm) {
          error(
            `Package "${name}" build tool (tsup.config.ts) is not configured to output both cjs and esm formats.`
          );
        }
        if (!hasDts) {
          error(
            `Package "${name}" build tool (tsup.config.ts) is not configured to generate TypeScript declarations (dts).`
          );
        }
      } else {
        // If no config file, check if flags are in the package.json script
        const hasCjs =
          buildScript.includes("cjs") ||
          buildScript.includes("cjs,esm") ||
          buildScript.includes("esm,cjs");
        const hasEsm =
          buildScript.includes("esm") ||
          buildScript.includes("cjs,esm") ||
          buildScript.includes("esm,cjs");
        const hasDts = buildScript.includes("--dts");
        if (!hasCjs || !hasEsm) {
          error(
            `Package "${name}" build script "${buildScript}" is missing dual-format cjs/esm output configurations.`
          );
        }
        if (!hasDts) {
          error(
            `Package "${name}" build script "${buildScript}" is missing --dts flag for TypeScript declarations.`
          );
        }
      }
    } else if (buildScript.includes("tsc")) {
      // If it uses tsc, check tsconfig.json or tsconfig.build.json
      const tsconfigPath = path.join(dir, "tsconfig.json");
      if (fs.existsSync(tsconfigPath)) {
        let tsconfig;
        try {
          tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
        } catch (e) {
          error(`Failed to parse tsconfig.json in ${name}: ${e.message}`);
        }
        const declaration =
          tsconfig &&
          tsconfig.compilerOptions &&
          tsconfig.compilerOptions.declaration;
        if (!declaration) {
          error(
            `Package "${name}" build script uses tsc but tsconfig.json compilerOptions.declaration is not true.`
          );
        }
      }
    } else {
      info(
        `Package "${name}" uses build system: "${buildScript}". Custom build configurations should manually support CJS, ESM, and Types.`
      );
    }
  }

  // Exports Validation (Fields present and point to existing files)
  const verifyFileExists = (filePath, fieldName) => {
    if (!filePath) return;
    const resolvedPath = path.resolve(dir, filePath);
    if (!fs.existsSync(resolvedPath)) {
      error(
        `Package "${name}" field "${fieldName}" points to non-existent file: "${filePath}" (resolved: "${resolvedPath}")`
      );
    }
  };

  verifyFileExists(json.main, "main");
  verifyFileExists(json.module, "module");
  verifyFileExists(json.types, "types");

  if (json.exports) {
    const exportsRoot = json.exports["."];
    if (!exportsRoot) {
      error(`Package "${name}" exports must contain a root "." export entry.`);
    } else {
      if (!exportsRoot.types)
        error(`Package "${name}" exports["."] is missing "types" condition.`);
      if (!exportsRoot.import)
        error(`Package "${name}" exports["."] is missing "import" condition.`);
      if (!exportsRoot.require)
        error(`Package "${name}" exports["."] is missing "require" condition.`);

      verifyFileExists(exportsRoot.types, 'exports["."].types');
      verifyFileExists(exportsRoot.import, 'exports["."].import');
      verifyFileExists(exportsRoot.require, 'exports["."].require');
    }
  }
}

if (failed) {
  console.error(
    "\n\x1b[31m[FAIL]\x1b[0m Release validation failed. Please fix the errors above."
  );
  process.exit(1);
} else {
  info("\x1b[32m[SUCCESS]\x1b[0m All release validation checks passed!");
}
