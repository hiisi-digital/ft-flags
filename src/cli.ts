/**
 * @module cli
 * CLI tool for querying and validating feature flags.
 *
 * Usage:
 *   ft-flags list [--enabled] [--available]
 *   ft-flags check <feature> [--features <f1,f2>] [--no-default-features]
 *   ft-flags resolve [--features <f1,f2>] [--no-default-features] [--all-features]
 *   ft-flags tree [<feature>]
 *   ft-flags validate
 */

import {
  buildFeatureTree,
  type FeatureManifest,
  getEnableChain,
  isFeatureEnabled,
  listAvailableFeatures,
  listDisabledFeatures,
  listEnabledFeatures,
  loadManifest,
  loadManifestFromDenoJson,
  loadManifestFromPackageJson,
  renderFeatureTree,
  resolveFeatures,
  type ResolveOptions,
  validateManifest,
} from "./manifest.ts";

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: "",
    positional: [],
    flags: {},
  };

  let i = 0;

  // Parse flags that come before the command (like --package)
  while (i < args.length) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      // First non-flag argument is the command
      result.command = arg;
      i++;
      break;
    }

    // Handle flags before command
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result.flags[key] = value;
      } else {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          result.flags[key] = nextArg;
          i++;
        } else {
          result.flags[key] = true;
        }
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result.flags[key] = nextArg;
        i++;
      } else {
        result.flags[key] = true;
      }
    }
    i++;
  }

  // Parse remaining arguments
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        // --flag=value
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result.flags[key] = value;
      } else {
        // --flag or --flag value
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          result.flags[key] = nextArg;
          i++;
        } else {
          result.flags[key] = true;
        }
      }
    } else if (arg.startsWith("-")) {
      // Short flags like -f
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        result.flags[key] = nextArg;
        i++;
      } else {
        result.flags[key] = true;
      }
    } else {
      result.positional.push(arg);
    }

    i++;
  }

  return result;
}

function getResolveOptions(flags: Record<string, string | boolean>): ResolveOptions {
  const options: ResolveOptions = {};

  if (flags.features) {
    const featuresStr = String(flags.features);
    options.features = featuresStr.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (flags["no-default-features"]) {
    options.noDefaultFeatures = true;
  }

  if (flags["all-features"]) {
    options.allFeatures = true;
  }

  return options;
}

// =============================================================================
// Output Helpers
// =============================================================================

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function colorize(text: string, color: keyof typeof COLORS): string {
  // Check if stdout supports colors
  const noColor = Deno.env.get("NO_COLOR") !== undefined;
  if (noColor) {
    return text;
  }
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function success(text: string): string {
  return colorize("[ok]", "green") + " " + text;
}

function failure(text: string): string {
  return colorize("[x]", "red") + " " + text;
}

function warning(text: string): string {
  return colorize("[!]", "yellow") + " " + text;
}

// =============================================================================
// Commands
// =============================================================================

function cmdList(
  manifest: FeatureManifest,
  flags: Record<string, string | boolean>,
): number {
  const showEnabled = flags.enabled === true;
  const showAvailable = flags.available === true || !showEnabled;

  if (showAvailable && !showEnabled) {
    console.log(colorize("Available features:", "bold"));
    console.log();

    const features = listAvailableFeatures(manifest);
    for (const name of features) {
      const deps = manifest.features.get(name) ?? [];
      const depsStr = deps.length > 0 ? `-> [${deps.join(", ")}]` : "-> []";
      const meta = manifest.metadata.get(name);

      let line = `  ${colorize(name, "blue")} ${colorize(depsStr, "dim")}`;
      if (meta?.deprecated) {
        line += ` ${colorize("(deprecated)", "yellow")}`;
      }
      if (meta?.unstable) {
        line += ` ${colorize("(unstable)", "yellow")}`;
      }
      console.log(line);

      if (meta?.description) {
        console.log(`    ${colorize(meta.description, "dim")}`);
      }
    }
  }

  if (showEnabled) {
    const options = getResolveOptions(flags);
    const resolved = resolveFeatures(manifest, options);

    console.log(colorize("Enabled features:", "bold"));
    console.log();

    const enabled = listEnabledFeatures(resolved);
    for (const name of enabled) {
      const chain = getEnableChain(name, resolved);
      let chainStr = "";
      if (chain && chain.length > 1) {
        chainStr = ` ${colorize(`(via: ${chain.join(" -> ")})`, "dim")}`;
      }
      console.log(`  ${colorize("[ok]", "green")} ${name}${chainStr}`);
    }

    const disabled = listDisabledFeatures(resolved);
    if (disabled.length > 0) {
      console.log();
      console.log(colorize("Disabled features:", "dim"));
      for (const name of disabled) {
        console.log(`  ${colorize("[ ]", "dim")} ${name}`);
      }
    }
  }

  return 0;
}

function cmdCheck(
  manifest: FeatureManifest,
  featureName: string,
  flags: Record<string, string | boolean>,
): number {
  const options = getResolveOptions(flags);
  const resolved = resolveFeatures(manifest, options);

  const enabled = isFeatureEnabled(featureName, resolved);

  if (enabled) {
    const chain = getEnableChain(featureName, resolved);
    const chainStr = chain && chain.length > 1 ? `(via: ${chain.join(" -> ")})` : "(explicit)";
    console.log(
      success(`${colorize(featureName, "bold")} is enabled ${colorize(chainStr, "dim")}`),
    );
    return 0;
  } else {
    if (!manifest.features.has(featureName)) {
      console.log(failure(`${colorize(featureName, "bold")} is not defined in the manifest`));
    } else {
      console.log(failure(`${colorize(featureName, "bold")} is not enabled`));
    }
    return 1;
  }
}

function cmdResolve(
  manifest: FeatureManifest,
  flags: Record<string, string | boolean>,
): number {
  const options = getResolveOptions(flags);
  const resolved = resolveFeatures(manifest, options);

  console.log(colorize("Resolved features:", "bold"));
  console.log();

  const enabled = listEnabledFeatures(resolved);
  if (enabled.length === 0) {
    console.log("  (none)");
  } else {
    console.log(`  ${enabled.join(", ")}`);
  }

  console.log();
  console.log(colorize("Resolution options:", "dim"));
  console.log(`  --no-default-features: ${options.noDefaultFeatures ?? false}`);
  console.log(`  --all-features: ${options.allFeatures ?? false}`);
  if (options.features && options.features.length > 0) {
    console.log(`  --features: ${options.features.join(", ")}`);
  }

  return 0;
}

function cmdTree(
  manifest: FeatureManifest,
  rootFeature: string | undefined,
): number {
  const nodes = buildFeatureTree(manifest, rootFeature);

  if (nodes.length === 0) {
    if (rootFeature) {
      console.log(failure(`Feature "${rootFeature}" not found in manifest`));
      return 1;
    }
    console.log("No features defined");
    return 0;
  }

  console.log(colorize("Feature tree:", "bold"));
  console.log();

  // Render without the prefix for top-level
  for (const node of nodes) {
    console.log(node.name);
    if (node.children.length > 0) {
      console.log(renderFeatureTree(node.children, ""));
    }
  }

  return 0;
}

function cmdValidate(manifest: FeatureManifest): number {
  const result = validateManifest(manifest);

  if (result.valid && result.warnings.length === 0) {
    console.log(success("Configuration is valid"));
    return 0;
  }

  if (result.errors.length > 0) {
    console.log(colorize("Errors:", "red"));
    for (const error of result.errors) {
      console.log(`  ${failure(error)}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(colorize("Warnings:", "yellow"));
    for (const warn of result.warnings) {
      console.log(`  ${warning(warn)}`);
    }
  }

  return result.valid ? 0 : 1;
}

function printHelp(): void {
  console.log(`
${colorize("ft", "bold")} - Feature flag CLI for TypeScript

${colorize("USAGE:", "bold")}
    ft <command> [options]

${colorize("COMMANDS:", "bold")}
    list                List available features
    check <feature>     Check if a feature is enabled
    resolve             Show resolved feature set
    tree [feature]      Display feature dependency tree
    validate            Validate the feature configuration
    help                Show this help message

${colorize("OPTIONS:", "bold")}
    --features <f1,f2>      Enable specific features (comma-separated)
    --no-default-features   Don't enable the 'default' feature
    --all-features          Enable all available features
    --enabled               Show only enabled features (for 'list')
    --available             Show all available features (for 'list')
    --package <path>        Path to package directory

${colorize("EXAMPLES:", "bold")}
    ft list
    ft list --enabled
    ft check async-runtime
    ft check experimental --features experimental
    ft resolve --no-default-features --features full
    ft tree
    ft tree default
    ft validate

${colorize("ENVIRONMENT:", "bold")}
    FT_FEATURES               Comma-separated features to enable
    FT_NO_DEFAULT_FEATURES    Set to 'true' to disable defaults
    FT_ALL_FEATURES           Set to 'true' to enable all features
    NO_COLOR                  Disable colored output
`);
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function main(args: string[]): Promise<number> {
  const parsed = parseArgs(args);

  // Apply environment variable overrides (FT_ prefix)
  const envFeatures = Deno.env.get("FT_FEATURES");
  if (envFeatures && !parsed.flags.features) {
    parsed.flags.features = envFeatures;
  }
  if (Deno.env.get("FT_NO_DEFAULT_FEATURES") === "true") {
    parsed.flags["no-default-features"] = true;
  }
  if (Deno.env.get("FT_ALL_FEATURES") === "true") {
    parsed.flags["all-features"] = true;
  }

  // Handle help
  if (!parsed.command || parsed.command === "help" || parsed.flags.help || parsed.flags.h) {
    printHelp();
    return 0;
  }

  // Load manifest
  const packagePath = parsed.flags.package as string | undefined;
  let manifest: FeatureManifest | null = null;

  if (packagePath) {
    // Try to load from specified package path
    const denoPath = `${packagePath}/deno.json`;
    const pkgPath = `${packagePath}/package.json`;

    try {
      manifest = await loadManifestFromDenoJson(denoPath);
      if (!manifest) {
        manifest = await loadManifestFromPackageJson(pkgPath);
      }
    } catch (e) {
      console.error(failure(`Failed to load manifest from ${packagePath}: ${e}`));
      return 1;
    }
  } else {
    manifest = await loadManifest();
  }

  if (!manifest) {
    console.error(failure("No feature configuration found in deno.json or package.json"));
    console.error(colorize("Add a 'features' map to your config file.", "dim"));
    return 1;
  }

  // Execute command
  switch (parsed.command) {
    case "list":
      return cmdList(manifest, parsed.flags);

    case "check": {
      const feature = parsed.positional[0];
      if (!feature) {
        console.error(failure("Missing feature argument"));
        console.error("Usage: ft-flags check <feature>");
        return 1;
      }
      return cmdCheck(manifest, feature, parsed.flags);
    }

    case "resolve":
      return cmdResolve(manifest, parsed.flags);

    case "tree": {
      const rootFeature = parsed.positional[0];
      return cmdTree(manifest, rootFeature);
    }

    case "validate":
      return cmdValidate(manifest);

    default:
      console.error(failure(`Unknown command: ${parsed.command}`));
      printHelp();
      return 1;
  }
}

// Run if executed directly
if (import.meta.main) {
  const exitCode = await main(Deno.args);
  Deno.exit(exitCode);
}
