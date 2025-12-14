/**
 * @module config
 * Configuration loading for feature flags from various sources.
 *
 * Configuration sources in order of precedence (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables
 * 3. deno.json / package.json (via manifest.ts)
 * 4. Defaults
 */

import type { ConfigSource, FeatureConfig, ResolvedConfig } from "./types.ts";

/**
 * Options for loading configuration.
 */
export interface LoadConfigOptions {
  /** Environment variable prefix (default: "FT_") */
  readonly envPrefix?: string;
  /** Whether to load from environment (default: true) */
  readonly loadEnv?: boolean;
}

/**
 * Loads feature flags from environment variables.
 *
 * Environment variables are prefixed with FT_ (or custom prefix).
 * - FT_FEATURES=fs,env -> enables those features
 * - FT_DISABLED=experimental -> disables that feature
 * - FT_ENABLE_ALL=true -> enables all features
 * - FT_DISABLE_ALL=true -> disables all features
 *
 * @param prefix - Environment variable prefix (default: "FT_")
 * @returns Feature config derived from environment
 */
export function loadFromEnv(prefix: string = "FT_"): FeatureConfig {
  const enabled: string[] = [];
  const disabled: string[] = [];
  let enableAll = false;
  let disableAll = false;

  // Check for enabled features (support both FEATURES and ENABLED)
  const enabledVar = Deno.env.get(`${prefix}FEATURES`) ?? Deno.env.get(`${prefix}ENABLED`);
  if (enabledVar) {
    enabled.push(...enabledVar.split(",").map((s) => s.trim()).filter(Boolean));
  }

  // Check for disabled features
  const disabledVar = Deno.env.get(`${prefix}DISABLED`);
  if (disabledVar) {
    disabled.push(...disabledVar.split(",").map((s) => s.trim()).filter(Boolean));
  }

  // Check for enable all
  const enableAllVar = Deno.env.get(`${prefix}ENABLE_ALL`) ?? Deno.env.get(`${prefix}ALL_FEATURES`);
  if (enableAllVar?.toLowerCase() === "true" || enableAllVar === "1") {
    enableAll = true;
  }

  // Check for disable all
  const disableAllVar = Deno.env.get(`${prefix}DISABLE_ALL`);
  if (disableAllVar?.toLowerCase() === "true" || disableAllVar === "1") {
    disableAll = true;
  }

  // Check for no-default-features
  const noDefaultVar = Deno.env.get(`${prefix}NO_DEFAULT_FEATURES`);
  const noDefault = noDefaultVar?.toLowerCase() === "true" || noDefaultVar === "1";

  return {
    enabled: enabled.length > 0 ? enabled : undefined,
    disabled: disabled.length > 0 ? disabled : undefined,
    enableAll: enableAll || undefined,
    disableAll: (disableAll || noDefault) || undefined,
  };
}

/**
 * Parses CLI arguments for feature flag settings.
 *
 * Supported arguments:
 * - --features=<id,id2> or --features <id,id2> -> enables features
 * - --no-default-features -> disables all features by default
 * - --all-features -> enables all features
 *
 * @param args - Command line arguments array
 * @returns Feature config derived from CLI args
 */
export function loadFromCli(args: string[]): FeatureConfig {
  const enabled: string[] = [];
  let enableAll = false;
  let disableAll = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // --features=<id,id2> or --features <id,id2>
    if (arg.startsWith("--features=")) {
      const value = arg.slice("--features=".length);
      enabled.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg === "--features" || arg === "-f") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        i++;
        enabled.push(...args[i].split(",").map((s) => s.trim()).filter(Boolean));
      }
    } // --no-default-features
    else if (arg === "--no-default-features") {
      disableAll = true;
    } // --all-features
    else if (arg === "--all-features") {
      enableAll = true;
    }
  }

  return {
    enabled: enabled.length > 0 ? enabled : undefined,
    enableAll: enableAll || undefined,
    disableAll: disableAll || undefined,
  };
}

/**
 * Loads configuration from environment with optional CLI override.
 *
 * @param options - Load options
 * @returns Configuration from environment
 */
export function loadEnvConfig(
  options?: LoadConfigOptions,
): ResolvedConfig {
  let config: FeatureConfig = {};
  let source: ConfigSource = { type: "programmatic" };

  // Load from environment if enabled
  if (options?.loadEnv !== false) {
    const envConfig = loadFromEnv(options?.envPrefix);
    if (
      envConfig.enabled?.length || envConfig.disabled?.length || envConfig.enableAll ||
      envConfig.disableAll
    ) {
      config = envConfig;
      source = { type: "env", variable: `${options?.envPrefix ?? "FT_"}*` };
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
