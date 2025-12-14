/**
 * Generate platform-specific READMEs from the canonical README.md template.
 *
 * The canonical README contains HTML comment markers that define sections
 * to be replaced for each platform:
 *
 * <!-- SECTION_NAME:START -->
 * content to replace
 * <!-- SECTION_NAME:END -->
 *
 * Usage:
 *   deno run -A scripts/generate_readme.ts <platform> [output-path]
 *
 * Platforms:
 *   - deno: Deno/JSR optimized README
 *   - node: Node.js/npm optimized README
 *
 * @module
 */

// =============================================================================
// Platform-specific content replacements
// =============================================================================

interface PlatformConfig {
  /** Display name for this platform */
  name: string;
  /** Package registry name */
  registry: string;
  /** URL to this platform's package */
  packageUrl: string;
  /** URL to the other platform's package */
  otherPlatformUrl: string;
  /** Other platform name */
  otherPlatformName: string;
  /** Other platform registry */
  otherRegistry: string;
  /** Section replacements */
  sections: Record<string, string>;
}

const DENO_CONFIG: PlatformConfig = {
  name: "Deno",
  registry: "JSR",
  packageUrl: "https://jsr.io/@hiisi/ft-flags",
  otherPlatformUrl: "https://www.npmjs.com/package/ft-flags",
  otherPlatformName: "Node.js/Bun",
  otherRegistry: "npm",
  sections: {
    PLATFORM_NOTICE: `> **Deno/JSR package:** This is the Deno-optimized version of ft-flags.
> For Node.js or Bun, see [ft-flags on npm](https://www.npmjs.com/package/ft-flags).`,

    INSTALL: `\`\`\`typescript
// Import directly from JSR
import { loadManifest, resolveFeatures } from "jsr:@hiisi/ft-flags";

// Or add to your deno.json imports
// "imports": { "@hiisi/ft-flags": "jsr:@hiisi/ft-flags@^0.1.0" }
\`\`\`

Or using the Deno CLI:

\`\`\`bash
deno add jsr:@hiisi/ft-flags
\`\`\``,

    CONFIG_FILE:
      `Features are declared at the root level of your \`deno.json\`. The format follows Cargo's conventions:`,

    CLI_INSTALL: `\`\`\`bash
# Global install
deno install -A -n ft jsr:@hiisi/ft-flags/cli

# Or run directly
deno run -A jsr:@hiisi/ft-flags/cli <command>

# Or via deno task (when in a project with ft-flags)
deno task ft <command>
\`\`\``,

    IMPORT_EXAMPLE: `\`\`\`typescript
import {
  isFeatureEnabled,
  listAvailableFeatures,
  loadManifest,
  resolveFeatures,
} from "@hiisi/ft-flags";

// Load features from deno.json
const manifest = await loadManifest();

// Resolve with default features
const resolved = resolveFeatures(manifest);

// Check if a feature is enabled
if (isFeatureEnabled("fs", resolved)) {
  // Use filesystem features
}

// List all available features
const available = listAvailableFeatures(manifest);
console.log(available); // ["default", "std", "fs", ...]
\`\`\``,

    RELATED_IMPORT:
      `\`ft-flags\` is designed to work with \`@hiisi/cfg-ts\` for conditional compilation:

\`\`\`typescript
import { cfg } from "@hiisi/cfg-ts";

// @cfg(feature("fs"))
export function readFile(path: string): string {
  // This function is only included when fs is enabled
}

// @cfg(not(feature("experimental")))
export function stableApi(): void {
  // Only included when experimental is NOT enabled
}

// @cfg(all(feature("std"), not(feature("legacy"))))
export function modernStdLib(): void {
  // Complex predicates
}
\`\`\``,

    RELATED_PACKAGES:
      `- [\`@hiisi/cfg-ts\`](https://jsr.io/@hiisi/cfg-ts) - Conditional compilation with \`@cfg()\` syntax
- [\`@hiisi/otso\`](https://jsr.io/@hiisi/otso) - Build framework that orchestrates feature-based builds
- [\`@hiisi/tgts\`](https://jsr.io/@hiisi/tgts) - Target definitions (runtime, platform, arch)
- [\`@hiisi/onlywhen\`](https://jsr.io/@hiisi/onlywhen) - Runtime feature detection`,
  },
};

const NODE_CONFIG: PlatformConfig = {
  name: "Node.js/Bun",
  registry: "npm",
  packageUrl: "https://www.npmjs.com/package/ft-flags",
  otherPlatformUrl: "https://jsr.io/@hiisi/ft-flags",
  otherPlatformName: "Deno",
  otherRegistry: "JSR",
  sections: {
    PLATFORM_NOTICE: `> **npm package:** This is the Node.js and Bun optimized version of ft-flags.
> For Deno, see [@hiisi/ft-flags on JSR](https://jsr.io/@hiisi/ft-flags).`,

    INSTALL: `\`\`\`bash
# npm
npm install ft-flags

# yarn
yarn add ft-flags

# pnpm
pnpm add ft-flags
\`\`\``,

    CONFIG_FILE:
      `Features are declared at the root level of your \`package.json\`. The format follows Cargo's conventions:`,

    CLI_INSTALL: `\`\`\`bash
# Run via npx
npx ft <command>

# Or install globally
npm install -g ft-flags
ft <command>
\`\`\``,

    IMPORT_EXAMPLE: `\`\`\`typescript
import {
  isFeatureEnabled,
  listAvailableFeatures,
  loadManifest,
  resolveFeatures,
} from "ft-flags";

// Load features from package.json
const manifest = await loadManifest();

// Resolve with default features
const resolved = resolveFeatures(manifest);

// Check if a feature is enabled
if (isFeatureEnabled("fs", resolved)) {
  // Use filesystem features
}

// List all available features
const available = listAvailableFeatures(manifest);
console.log(available); // ["default", "std", "fs", ...]
\`\`\``,

    RELATED_IMPORT: `\`ft-flags\` is designed to work with \`cfg-ts\` for conditional compilation:

\`\`\`typescript
import { cfg } from "cfg-ts";

// @cfg(feature("fs"))
export function readFile(path: string): string {
  // This function is only included when fs is enabled
}

// @cfg(not(feature("experimental")))
export function stableApi(): void {
  // Only included when experimental is NOT enabled
}

// @cfg(all(feature("std"), not(feature("legacy"))))
export function modernStdLib(): void {
  // Complex predicates
}
\`\`\``,

    RELATED_PACKAGES:
      `- [\`cfg-ts\`](https://www.npmjs.com/package/cfg-ts) - Conditional compilation with \`@cfg()\` syntax
- [\`otso\`](https://www.npmjs.com/package/otso) - Build framework that orchestrates feature-based builds
- [\`tgts\`](https://www.npmjs.com/package/tgts) - Target definitions (runtime, platform, arch)
- [\`onlywhen\`](https://www.npmjs.com/package/onlywhen) - Runtime feature detection`,
  },
};

const PLATFORMS: Record<string, PlatformConfig> = {
  deno: DENO_CONFIG,
  node: NODE_CONFIG,
};

// =============================================================================
// Template processing
// =============================================================================

/**
 * Replaces a section in the README content.
 *
 * Sections are marked with:
 * <!-- SECTION_NAME:START -->
 * content
 * <!-- SECTION_NAME:END -->
 */
function replaceSection(
  content: string,
  sectionName: string,
  replacement: string,
): string {
  const startMarker = `<!-- ${sectionName}:START -->`;
  const endMarker = `<!-- ${sectionName}:END -->`;

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.warn(`Warning: Section ${sectionName} not found in README`);
    return content;
  }

  const before = content.slice(0, startIndex + startMarker.length);
  const after = content.slice(endIndex);

  return `${before}\n${replacement}\n${after}`;
}

/**
 * Removes template markers from the final output.
 */
function removeMarkers(content: string): string {
  // Remove all section markers
  return content.replace(/<!-- [A-Z_]+:(START|END) -->\n?/g, "");
}

/**
 * Generates a platform-specific README from the template.
 */
function generateReadme(template: string, platform: PlatformConfig): string {
  let result = template;

  // Replace each section
  for (const [sectionName, replacement] of Object.entries(platform.sections)) {
    result = replaceSection(result, sectionName, replacement);
  }

  // Remove the markers
  result = removeMarkers(result);

  return result;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = Deno.args;

  if (args.length < 1) {
    console.error("Usage: deno run -A scripts/generate_readme.ts <platform> [output-path]");
    console.error("Platforms: deno, node");
    Deno.exit(1);
  }

  const platformName = args[0].toLowerCase();
  const outputPath = args[1];

  const platform = PLATFORMS[platformName];
  if (!platform) {
    console.error(`Unknown platform: ${platformName}`);
    console.error(`Available platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    Deno.exit(1);
  }

  // Read the canonical README
  const templatePath = new URL("../README.md", import.meta.url).pathname;
  const template = await Deno.readTextFile(templatePath);

  // Generate platform-specific README
  const readme = generateReadme(template, platform);

  // Output
  if (outputPath) {
    await Deno.writeTextFile(outputPath, readme);
    console.log(`Generated ${platform.name} README at ${outputPath}`);
  } else {
    console.log(readme);
  }
}

if (import.meta.main) {
  await main();
}

export { generateReadme, type PlatformConfig, PLATFORMS };
