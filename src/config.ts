/**
 * @module config
 * Configuration loading for feature flags from various sources.
 *
 * Configuration sources in order of precedence (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables
 * 3. deno.json / package.json
 * 4. Defaults
 */

import type {
    ConfigSource,
    FeatureConfig,
    ResolvedConfig,
} from "./types.ts";
import { ConfigLoadError } from "./types.ts";

/**
 * Full feature flags configuration from a config file.
 */
export interface FeatureFlagsConfig {
  /** Features to enable */
  readonly enabled?: readonly string[];
  /** Features to disable (overrides enabled) */
  readonly disabled?: readonly string[];
  /** Enable all features by default */
  readonly enableAll?: boolean;
  /** Disable all features by default */
  readonly disableAll?: boolean;
  /** Feature schema definitions (for validation) */
  readonly features?: readonly FeatureDefinitionConfig[];
}

/**
 * Feature definition in config file format.
 */
export interface FeatureDefinitionConfig {
  readonly id: string;
  readonly description?: string;
  readonly defaultEnabled?: boolean;
  readonly experimental?: boolean;
  readonly deprecated?: boolean;
}

/**
 * Options for loading configuration.
 */
export interface LoadConfigOptions {
  /** Path to deno.json (default: auto-detect) */
  readonly denoJsonPath?: string;
  /** Path to package.json (default: auto-detect) */
  readonly packageJsonPath?: string;
  /** Environment variable prefix (default: "FT_FLAGS_") */
  readonly envPrefix?: string;
  /** Whether to load from environment (default: true) */
  readonly loadEnv?: boolean;
  /** Whether to throw on missing config files (default: false) */
  readonly throwOnMissing?: boolean;
}

/**
 * Loads feature flags configuration from deno.json.
 *
 * @param path - Path to deno.json file (default: "./deno.json")
 * @returns Parsed feature flags config or null if not found
 */
export async function loadFromDenoJson(
  path?: string
): Promise<FeatureFlagsConfig | null> {
  const configPath = path ?? "./deno.json";

  try {
    const content = await Deno.readTextFile(configPath);
    const json = JSON.parse(content) as Record<string, unknown>;

    // Look for "ftFlags" or "featureFlags" field
    const ftFlags = json.ftFlags ?? json.featureFlags;

    if (!ftFlags) {
      return null;
    }

    return ftFlags as FeatureFlagsConfig;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw new ConfigLoadError(
      `Failed to load deno.json: ${error instanceof Error ? error.message : String(error)}`,
      configPath
    );
  }
}

/**
 * Loads feature flags configuration from package.json.
 *
 * @param path - Path to package.json file (default: "./package.json")
 * @returns Parsed feature flags config or null if not found
 */
export async function loadFromPackageJson(
  path?: string
): Promise<FeatureFlagsConfig | null> {
  const configPath = path ?? "./package.json";

  try {
    const content = await Deno.readTextFile(configPath);
    const json = JSON.parse(content) as Record<string, unknown>;

    // Look for "ftFlags" or "featureFlags" field
    const ftFlags = json.ftFlags ?? json.featureFlags;

    if (!ftFlags) {
      return null;
    }

    return ftFlags as FeatureFlagsConfig;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw new ConfigLoadError(
      `Failed to load package.json: ${error instanceof Error ? error.message : String(error)}`,
      configPath
    );
  }
}

/**
 * Loads feature flags from environment variables.
 *
 * Environment variables are prefixed with FT_FLAGS_ (or custom prefix).
 * - FT_FLAGS_ENABLED=shimp.fs,shimp.env -> enables those features
 * - FT_FLAGS_DISABLED=experimental -> disables that feature
 * - FT_FLAGS_ENABLE_ALL=true -> enables all features
 * - FT_FLAGS_DISABLE_ALL=true -> disables all features
 *
 * @param prefix - Environment variable prefix (default: "FT_FLAGS_")
 * @returns Feature config derived from environment
 */
export function loadFromEnv(prefix: string = "FT_FLAGS_"): FeatureConfig {
  const enabled: string[] = [];
  const disabled: string[] = [];
  let enableAll = false;
  let disableAll = false;

  // Check for enabled features
  const enabledVar = Deno.env.get(`${prefix}ENABLED`);
  if (enabledVar) {
    enabled.push(...enabledVar.split(",").map((s) => s.trim()).filter(Boolean));
  }

  // Check for disabled features
  const disabledVar = Deno.env.get(`${prefix}DISABLED`);
  if (disabledVar) {
    disabled.push(...disabledVar.split(",").map((s) => s.trim()).filter(Boolean));
  }

  // Check for enable all
  const enableAllVar = Deno.env.get(`${prefix}ENABLE_ALL`);
  if (enableAllVar?.toLowerCase() === "true" || enableAllVar === "1") {
    enableAll = true;
  }

  // Check for disable all
  const disableAllVar = Deno.env.get(`${prefix}DISABLE_ALL`);
  if (disableAllVar?.toLowerCase() === "true" || disableAllVar === "1") {
    disableAll = true;
  }

  return {
    enabled: enabled.length > 0 ? enabled : undefined,
    disabled: disabled.length > 0 ? disabled : undefined,
    enableAll: enableAll || undefined,
    disableAll: disableAll || undefined,
  };
}

/**
 * Parses CLI arguments for feature flag settings.
 *
 * Supported arguments:
 * - --feature=<id> or -f <id> -> enables a feature
 * - --no-feature=<id> -> disables a feature
 * - --enable-all-features -> enables all features
 * - --disable-all-features -> disables all features
 *
 * @param args - Command line arguments array
 * @returns Feature config derived from CLI args
 */
export function loadFromCli(args: string[]): FeatureConfig {
  const enabled: string[] = [];
  const disabled: string[] = [];
  let enableAll = false;
  let disableAll = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // --feature=<id> or --feature <id>
    if (arg.startsWith("--feature=")) {
      const value = arg.slice("--feature=".length);
      enabled.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg === "--feature" || arg === "-f") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        i++;
        enabled.push(...args[i].split(",").map((s) => s.trim()).filter(Boolean));
      }
    }

    // --no-feature=<id> or --no-feature <id>
    else if (arg.startsWith("--no-feature=")) {
      const value = arg.slice("--no-feature=".length);
      disabled.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg === "--no-feature") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        i++;
        disabled.push(...args[i].split(",").map((s) => s.trim()).filter(Boolean));
      }
    }

    // --enable-all-features
    else if (arg === "--enable-all-features") {
      enableAll = true;
    }

    // --disable-all-features
    else if (arg === "--disable-all-features") {
      disableAll = true;
    }
  }

  return {
    enabled: enabled.length > 0 ? enabled : undefined,
    disabled: disabled.length > 0 ? disabled : undefined,
    enableAll: enableAll || undefined,
    disableAll: disableAll || undefined,
  };
}

/**
 * Auto-detects and loads configuration from the current directory.
 *
 * Tries in order:
 * 1. deno.json
 * 2. package.json
 *
 * Then merges with environment variables.
 *
 * @param options - Load options
 * @returns Merged configuration from all sources
 */
export async function autoLoadConfig(
  options?: LoadConfigOptions
): Promise<ResolvedConfig> {
  let fileConfig: FeatureFlagsConfig | null = null;
  let source: ConfigSource = { type: "programmatic" };

  // Try deno.json first
  const denoConfig = await loadFromDenoJson(options?.denoJsonPath);
  if (denoConfig) {
    fileConfig = denoConfig;
    source = { type: "deno.json", path: options?.denoJsonPath ?? "./deno.json" };
  }

  // Try package.json if deno.json didn't have config
  if (!fileConfig) {
    const packageConfig = await loadFromPackageJson(options?.packageJsonPath);
    if (packageConfig) {
      fileConfig = packageConfig;
      source = { type: "package.json", path: options?.packageJsonPath ?? "./package.json" };
    }
  }

  // Build base config from file
  let config: FeatureConfig = {};
  if (fileConfig) {
    config = {
      enabled: fileConfig.enabled ? [...fileConfig.enabled] : undefined,
      disabled: fileConfig.disabled ? [...fileConfig.disabled] : undefined,
      enableAll: fileConfig.enableAll,
      disableAll: fileConfig.disableAll,
    };
  }

  // Merge with environment if enabled
  if (options?.loadEnv !== false) {
    const envConfig = loadFromEnv(options?.envPrefix);
    config = mergeConfigs(config, envConfig);
    if (envConfig.enabled?.length || envConfig.disabled?.length || envConfig.enableAll || envConfig.disableAll) {
      source = { type: "env", variable: `${options?.envPrefix ?? "FT_FLAGS_"}*` };
    }
  }

  return {
    config,
    source,
  };
}

/**
 * Merges multiple feature configurations with proper precedence.
 * Later configs take precedence over earlier ones.
 *
 * @param configs - Array of configs, later ones take precedence
 * @returns Merged configuration
 */
export function mergeConfigs(...configs: FeatureConfig[]): FeatureConfig {
  const enabled: string[] = [];
  const disabled: string[] = [];
  let enableAll: boolean | undefined;
  let disableAll: boolean | undefined;

  for (const config of configs) {
    // Merge enabled lists
    if (config.enabled) {
      for (const id of config.enabled) {
        if (!enabled.includes(id)) {
          enabled.push(id);
        }
      }
    }

    // Merge disabled lists
    if (config.disabled) {
      for (const id of config.disabled) {
        if (!disabled.includes(id)) {
          disabled.push(id);
        }
      }
    }

    // Later enableAll/disableAll overrides earlier
    if (config.enableAll !== undefined) {
      enableAll = config.enableAll;
    }
    if (config.disableAll !== undefined) {
      disableAll = config.disableAll;
    }
  }

  return {
    enabled: enabled.length > 0 ? enabled : undefined,
    disabled: disabled.length > 0 ? disabled : undefined,
    enableAll,
    disableAll,
  };
}

/**
 * Converts a FeatureFlagsConfig to a FeatureConfig.
 *
 * @param fullConfig - The full config from a file
 * @returns A FeatureConfig for use with the registry
 */
export function toFeatureConfig(fullConfig: FeatureFlagsConfig): FeatureConfig {
  return {
    enabled: fullConfig.enabled ? [...fullConfig.enabled] : undefined,
    disabled: fullConfig.disabled ? [...fullConfig.disabled] : undefined,
    enableAll: fullConfig.enableAll,
    disableAll: fullConfig.disableAll,
  };
}

/**
 * Creates a FeatureConfig from an array of enabled feature IDs.
 * This is a convenience function for simple use cases.
 *
 * @param enabledFeatures - Array of feature IDs to enable
 * @returns A FeatureConfig with those features enabled
 */
export function configFromEnabled(enabledFeatures: string[]): FeatureConfig {
  return {
    enabled: enabledFeatures,
  };
}

/**
 * Creates a FeatureConfig that disables specific features.
 *
 * @param disabledFeatures - Array of feature IDs to disable
 * @returns A FeatureConfig with those features disabled
 */
export function configFromDisabled(disabledFeatures: string[]): FeatureConfig {
  return {
    disabled: disabledFeatures,
  };
}

/**
 * Creates an empty FeatureConfig.
 *
 * @returns An empty FeatureConfig
 */
export function emptyConfig(): FeatureConfig {
  return {};
}

/**
 * Creates a FeatureConfig that enables all features.
 *
 * @returns A FeatureConfig with enableAll set to true
 */
export function enableAllConfig(): FeatureConfig {
  return {
    enableAll: true,
  };
}

/**
 * Creates a FeatureConfig that disables all features.
 *
 * @returns A FeatureConfig with disableAll set to true
 */
export function disableAllConfig(): FeatureConfig {
  return {
    disableAll: true,
  };
}
