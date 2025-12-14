/**
 * @module @hiisi/ft-flags
 *
 * Feature flags system for conditional compilation and runtime feature gating.
 * Follows Cargo-style feature conventions with flat features (kebab-case),
 * feature sets, and default features.
 *
 * @example
 * ```ts
 * import {
 *   loadManifest,
 *   resolveFeatures,
 *   isFeatureEnabled,
 *   listAvailableFeatures,
 * } from "@hiisi/ft-flags";
 *
 * // Load features from deno.json or package.json
 * const manifest = await loadManifest();
 *
 * // Resolve with default features
 * const resolved = resolveFeatures(manifest);
 *
 * // Check if a feature is enabled
 * if (isFeatureEnabled("fs", resolved)) {
 *   // Use filesystem features
 * }
 * ```
 *
 * @example
 * ```ts
 * import { createRegistry, isEnabled, featureId, buildSchema } from "@hiisi/ft-flags";
 *
 * // Define features with schema
 * const schema = buildSchema([
 *   { id: "fs", description: "File system access" },
 *   { id: "env", description: "Environment variable access" },
 *   { id: "async-runtime", description: "Async runtime support" },
 * ]);
 *
 * // Create registry with enabled features
 * const registry = createRegistry({
 *   schema,
 *   config: {
 *     enabled: ["fs", "env"],
 *   },
 * });
 *
 * // Check if features are enabled
 * if (isEnabled(featureId("fs"), registry)) {
 *   // Use filesystem features
 * }
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  ConfigSource,
  FeatureCheckResult,
  FeatureConfig,
  FeatureDefinition,
  FeatureDefinitionInput,
  FeatureId,
  FeatureMetadata,
  FeatureRegistry,
  FeatureSchema,
  FeatureState,
  FeatureStateReason,
  ResolvedConfig,
} from "./src/types.ts";

export {
  ConfigLoadError,
  FeatureFlagError,
  featureId,
  FeatureIdFormatError,
  FeatureNotEnabledError,
  FeatureNotFoundError,
  FeatureSchemaError,
  getDepFeature,
  getDepPackage,
  isDepFeatureRef,
  isValidFeatureId,
  unsafeFeatureId,
} from "./src/types.ts";

// =============================================================================
// Manifest (Cargo-style API)
// =============================================================================

export type {
  FeatureManifest,
  FeatureManifestMetadata,
  FeatureTreeNode,
  ManifestSource,
  ManifestValidation,
  RawFtFlagsConfig,
  ResolvedFeatures,
  ResolveOptions,
} from "./src/manifest.ts";

export {
  buildFeatureTree,
  createEmptyManifest,
  createSimpleManifest,
  detectCycles,
  getEnableChain,
  isFeatureEnabled,
  listAvailableFeatures,
  listDisabledFeatures as listManifestDisabledFeatures,
  listEnabledFeatures as listManifestEnabledFeatures,
  loadManifest,
  loadManifestFromDenoJson,
  loadManifestFromPackageJson,
  parseManifest,
  renderFeatureTree,
  resolveFeatures,
  toFeatureIdSet,
  toRawConfig,
  validateManifest,
} from "./src/manifest.ts";

// =============================================================================
// Schema
// =============================================================================

export {
  buildSchema,
  createEmptySchema,
  mergeSchemas,
  mergeValidationResults,
  validateFeatureDefinition,
  validateFeatureId,
  validateSchema,
} from "./src/schema.ts";

export type { ValidationResult } from "./src/schema.ts";

// =============================================================================
// Registry
// =============================================================================

export {
  cloneRegistry,
  createRegistry,
  createSimpleRegistry,
  disableFeature,
  enableFeature,
  getFeature,
  getFeatureState,
  isDisabled,
  isEnabled,
  listDisabledFeatures,
  listEnabledFeatures,
  listFeatures,
  mergeRegistries,
  requireFeature,
  setFeatureState,
} from "./src/registry.ts";

export type { CreateRegistryOptions } from "./src/registry.ts";

// =============================================================================
// Evaluation
// =============================================================================

export {
  allEnabled,
  anyEnabled,
  checkFeature,
  choose,
  countEnabled,
  filterDisabled,
  filterEnabled,
  noneEnabled,
  requireFeature as evalRequireFeature,
  whenDisabled,
  whenEnabled,
} from "./src/evaluate.ts";

// =============================================================================
// Configuration
// =============================================================================

export {
  configFromDisabled,
  configFromEnabled,
  disableAllConfig,
  emptyConfig,
  enableAllConfig,
  loadEnvConfig,
  loadFromCli,
  loadFromEnv,
  mergeConfigs,
} from "./src/config.ts";

export type { LoadConfigOptions } from "./src/config.ts";
