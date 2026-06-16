const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const hasNpmToken = !!process.env.NPM_TOKEN;

if (hasNpmToken) {
  console.log(
    "NPM_TOKEN environment variable is set. Running changeset publish..."
  );
  execSync("npx changeset publish", { stdio: "inherit" });
} else {
  console.log(
    "NPM_TOKEN environment variable is NOT set. Running dry-run publish for all public packages..."
  );
  const packagesDir = path.resolve(__dirname, "../packages");
  const packages = fs.readdirSync(packagesDir);
  let failed = false;

  for (const pkg of packages) {
    const pkgPath = path.join(packagesDir, pkg);
    if (!fs.statSync(pkgPath).isDirectory()) continue;

    const pkgJsonPath = path.join(pkgPath, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (pkgJson.private) {
      console.log(`Skipping private package: ${pkgJson.name}`);
      continue;
    }

    console.log(
      `\n\x1b[32m[DRY-RUN]\x1b[0m Simulating publishing for ${pkgJson.name} in ${pkgPath}...`
    );
    try {
      execSync("npm publish --dry-run", { cwd: pkgPath, stdio: "inherit" });
    } catch (err) {
      console.error(
        `\x1b[31m[ERROR]\x1b[0m Failed dry-run publish for ${pkgJson.name}:`,
        err.message
      );
      failed = true;
    }
  }

  if (failed) {
    console.error(
      "\n\x1b[31m[FAIL]\x1b[0m Release publish dry-run failed for one or more packages."
    );
    process.exit(1);
  } else {
    console.log(
      "\n\x1b[32m[SUCCESS]\x1b[0m All packages successfully passed the npm publish dry-run!"
    );
  }
}
