/**
 * @module @hiisi/ft-flags
 *
 * Feature flags system for conditional compilation and runtime feature gating.
 * Follows Cargo-style feature conventions with hierarchical features,
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
 * if (isFeatureEnabled("shimp.fs", resolved)) {
 *   // Use filesystem features
 * }
 * ```
 *
 * @example
 * ```ts
 * import { createRegistry, isEnabled, featureId, buildSchema } from "@hiisi/ft-flags";
 *
 * // Legacy API: Define features with schema
 * const schema = buildSchema([
 *   { id: "shimp" },
 *   { id: "shimp.fs", description: "File system access" },
 *   { id: "shimp.env", description: "Environment variable access" },
 * ]);
 *
 * // Create registry with enabled features
 * const registry = createRegistry({
 *   schema,
 *   config: {
 *     enabled: ["shimp.fs", "shimp.env"],
 *   },
 * });
 *
 * // Check if features are enabled
 * if (isEnabled(featureId("shimp.fs"), registry)) {
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
    ResolvedConfig
} from "./src/types.ts";

export {
    ConfigLoadError,
    FeatureFlagError,
    featureId,
    FeatureIdFormatError,
    FeatureNotEnabledError,
    FeatureNotFoundError,
    FeatureSchemaError,
    getAncestorFeatureIds,
    getDepFeature,
    getDepPackage,
    getFeatureDepth,
    isAncestorOf,
    isDepFeatureRef,
    isDescendantOf,
    isValidFeatureId,
    unsafeFeatureId
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
    ResolveOptions
} from "./src/manifest.ts";

export {
    buildFeatureTree,
    createEmptyManifest,
    createSimpleManifest,
    detectCycles,
    getEnableChain,
    isFeatureEnabled,
    listAvailableFeatures,
    listDisabledFeatures as listDisabledManifestFeatures,
    listEnabledFeatures as listEnabledManifestFeatures,
    loadManifest,
    loadManifestFromDenoJson,
    loadManifestFromPackageJson,
    parseManifest,
    renderFeatureTree,
    resolveFeatures,
    toFeatureIdSet,
    toRawConfig,
    validateManifest
} from "./src/manifest.ts";

// =============================================================================
// Schema (Legacy API)
// =============================================================================

export {
    buildSchema,
    createEmptySchema,
    detectCircularDependencies,
    getChildFeatureIds,
    getDescendantFeatureIds,
    mergeSchemas,
    mergeValidationResults,
    validateFeatureDefinition,
    validateFeatureId,
    validateSchema
} from "./src/schema.ts";

export type { ValidationResult } from "./src/schema.ts";

// =============================================================================
// Registry (Legacy API)
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
    setFeatureState
} from "./src/registry.ts";

export type { CreateRegistryOptions } from "./src/registry.ts";

// =============================================================================
// Evaluation (Legacy API)
// =============================================================================

export {
    allEnabled,
    anyEnabled,
    checkFeature,
    isDisabled as checkIsDisabled,
    isEnabled as checkIsEnabled,
    choose,
    contractFeatures,
    countEnabled,
    requireFeature as evalRequireFeature,
    expandFeatures,
    filterDisabled,
    filterEnabled,
    noneEnabled,
    whenDisabled,
    whenEnabled
} from "./src/evaluate.ts";

// =============================================================================
// Configuration (Legacy API)
// =============================================================================

export {
    autoLoadConfig,
    configFromDisabled,
    configFromEnabled,
    disableAllConfig,
    emptyConfig,
    enableAllConfig,
    loadFromCli,
    loadFromDenoJson,
    loadFromEnv,
    loadFromPackageJson,
    mergeConfigs,
    toFeatureConfig
} from "./src/config.ts";

export type {
    FeatureDefinitionConfig,
    FeatureFlagsConfig,
    LoadConfigOptions
} from "./src/config.ts";
