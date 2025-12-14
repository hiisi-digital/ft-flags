/**
 * @module @hiisi/ft-flags
 *
 * Feature flags system for conditional compilation and runtime feature gating.
 * Supports hierarchical features, configuration from multiple sources,
 * and integration with build-time tools.
 *
 * @example
 * ```ts
 * import { createRegistry, isEnabled, featureId, buildSchema } from "@hiisi/ft-flags";
 *
 * // Define features
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
// Types
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
    ConfigLoadError, FeatureFlagError, featureId, FeatureIdFormatError,
    FeatureNotEnabledError,
    FeatureNotFoundError,
    FeatureSchemaError,
    getAncestorFeatureIds,
    getFeatureDepth,
    getParentFeatureId,
    isAncestorOf,
    isDescendantOf,
    isValidFeatureId,
    unsafeFeatureId
} from "./src/types.ts";

// =============================================================================
// Schema
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
    setFeatureState
} from "./src/registry.ts";

export type { CreateRegistryOptions } from "./src/registry.ts";

// =============================================================================
// Evaluation
// =============================================================================

export {
    allEnabled,
    anyEnabled,
    checkFeature, isDisabled as checkIsDisabled,
    isEnabled as checkIsEnabled, choose,
    contractFeatures,
    countEnabled, requireFeature as evalRequireFeature, expandFeatures,
    filterDisabled,
    filterEnabled, noneEnabled, whenDisabled,
    whenEnabled
} from "./src/evaluate.ts";

// =============================================================================
// Configuration
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

