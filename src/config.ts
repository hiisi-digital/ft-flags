/**
 * @module config
 * Configuration loading for feature flags from various sources.
 */

import type { FeatureConfig, FeatureFlagsConfig } from "./types.ts";

/**
 * Configuration sources in order of precedence (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables
 * 3. deno.json / package.json
 * 4. Defaults
 */

// TODO: Load feature flags configuration from deno.json "ftFlags" field
// TODO: Load feature flags configuration from package.json "ftFlags" field
// TODO: Load from environment variables (FT_FLAGS_* prefix)
// TODO: Parse CLI arguments for --feature and --no-feature flags
// TODO: Merge configurations with proper precedence
// TODO: Validate loaded configuration against schema

/**
 * Loads feature flags configuration from deno.json.
 *
 * @param path - Path to deno.json file
 * @returns Parsed feature flags config or null if not found
 */
export async function loadFromDenoJson(
  _path?: string,
): Promise<FeatureFlagsConfig | null> {
  // TODO: Read deno.json file
  // TODO: Parse JSON and extract "ftFlags" field
  // TODO: Validate against FeatureFlagsConfig schema
  // TODO: Return null if file doesn't exist or field is missing
  throw new Error("Not implemented: loadFromDenoJson");
}

/**
 * Loads feature flags configuration from package.json.
 *
 * @param path - Path to package.json file
 * @returns Parsed feature flags config or null if not found
 */
export async function loadFromPackageJson(
  _path?: string,
): Promise<FeatureFlagsConfig | null> {
  // TODO: Read package.json file
  // TODO: Parse JSON and extract "ftFlags" field
  // TODO: Validate against FeatureFlagsConfig schema
  // TODO: Return null if file doesn't exist or field is missing
  throw new Error("Not implemented: loadFromPackageJson");
}

/**
 * Loads feature flags from environment variables.
 *
 * @returns Feature config derived from environment
 */
export function loadFromEnv(): FeatureConfig {
  // TODO: Scan for FT_FLAGS_* environment variables
  // TODO: Parse enabled/disabled features from env
  // TODO: Return FeatureConfig with enabled/disabled arrays
  throw new Error("Not implemented: loadFromEnv");
}

/**
 * Parses CLI arguments for feature flag settings.
 *
 * @param args - Command line arguments array
 * @returns Feature config derived from CLI args
 */
export function loadFromCli(_args: string[]): FeatureConfig {
  // TODO: Parse --feature=<id> and --no-feature=<id> arguments
  // TODO: Support comma-separated lists
  // TODO: Return FeatureConfig with enabled/disabled arrays
  throw new Error("Not implemented: loadFromCli");
}

/**
 * Auto-detects and loads configuration from the current directory.
 *
 * @returns Merged configuration from all sources
 */
export async function autoLoadConfig(): Promise<FeatureFlagsConfig> {
  // TODO: Try loading from deno.json first
  // TODO: Fall back to package.json if deno.json not found
  // TODO: Merge with environment variables
  // TODO: Return merged configuration
  throw new Error("Not implemented: autoLoadConfig");
}

/**
 * Merges multiple feature configurations with proper precedence.
 *
 * @param configs - Array of configs, later ones take precedence
 * @returns Merged configuration
 */
export function mergeConfigs(
  ..._configs: FeatureConfig[]
): FeatureConfig {
  // TODO: Merge enabled arrays (later wins on conflicts)
  // TODO: Merge disabled arrays (later wins on conflicts)
  // TODO: Handle explicit disable overriding enable
  throw new Error("Not implemented: mergeConfigs");
}
