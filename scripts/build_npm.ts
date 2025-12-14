/**
 * Build script for npm package using dnt (Deno to Node Transform)
 *
 * Usage:
 *   deno run -A scripts/build_npm.ts [version]
 *
 * Example:
 *   deno run -A scripts/build_npm.ts 0.1.0
 *
 * @module
 */

import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";
import { generateReadme, PLATFORMS } from "./generate_readme.ts";

const version = Deno.args[0];

if (!version) {
  console.error("Usage: deno run -A scripts/build_npm.ts <version>");
  console.error("Example: deno run -A scripts/build_npm.ts 0.1.0");
  Deno.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error("Expected semver format like 0.1.0 or 0.1.0-beta.1");
  Deno.exit(1);
}

console.log(`Building npm package version ${version}...`);

const outDir = "./npm";

await emptyDir(outDir);

await build({
  entryPoints: [
    "./mod.ts",
    {
      name: "./cli",
      path: "./src/cli.ts",
    },
    {
      name: "./manifest",
      path: "./src/manifest.ts",
    },
  ],
  outDir,
  // Exclude test files from the build
  filterDiagnostic(diagnostic): boolean {
    // Ignore diagnostics from test files
    if (diagnostic.file?.fileName.includes("/tests/")) {
      return false;
    }
    return true;
  },
  shims: {
    // Deno namespace shim for Node.js compatibility
    deno: true,
  },
  // Skip type checking (we already checked with Deno)
  typeCheck: "both",
  // Skip npm tests - we test with Deno
  test: false,
  // Generate declaration files
  declaration: "separate",
  // ESM only - CLI uses top-level await which isn't compatible with CJS
  scriptModule: false,
  // Package configuration
  package: {
    name: "ft-flags",
    version,
    description:
      "Feature flags for TypeScript with Cargo-style feature definitions, conditional compilation, and CLI tooling",
    license: "MPL-2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/hiisi-digital/ft-flags.git",
    },
    bugs: {
      url: "https://github.com/hiisi-digital/ft-flags/issues",
    },
    homepage: "https://github.com/hiisi-digital/ft-flags#readme",
    author: "Hiisi Digital <dev@hiisi.digital>",
    keywords: [
      "feature-flags",
      "feature-toggles",
      "conditional-compilation",
      "cargo-features",
      "typescript",
      "deno",
      "node",
      "cli",
    ],
    type: "module",
    bin: {
      ft: "./esm/src/cli.js",
    },
    engines: {
      node: ">=18.0.0",
    },
  },
  // Post-build steps
  async postBuild(): Promise<void> {
    // Copy additional files
    Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
    Deno.copyFileSync("schema.json", `${outDir}/schema.json`);

    // Generate Node.js-specific README from template
    console.log("Generating Node.js-specific README...");
    const template = await Deno.readTextFile("README.md");
    const nodeReadme = generateReadme(template, PLATFORMS.node);
    await Deno.writeTextFile(`${outDir}/README.md`, nodeReadme);

    // Create a Node.js-compatible CLI wrapper
    const cliWrapper = `#!/usr/bin/env node
import { main } from "./esm/src/cli.js";

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
`;
    Deno.writeTextFileSync(`${outDir}/cli.mjs`, cliWrapper);
  },
});

console.log(`\nBuild complete! Output in ${outDir}/`);
console.log("\nTo publish:");
console.log(`  cd ${outDir}`);
console.log("  npm publish");
