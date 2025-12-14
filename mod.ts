/**
 * @module @hiisi/ft-flags
 *
 * Feature flags system for conditional compilation and runtime feature gating.
 * Supports hierarchical features, configuration from multiple sources,
 * and integration with build-time tools.
 *
 * @example
 * ```ts
 * import { createRegistry, isEnabled, featureId } from "@hiisi/ft-flags";
 *
 * const registry = createRegistry({
 *   enabled: [featureId("shimp.fs"), featureId("shimp.env")],
 * });
 *
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
    FeatureMetadata,
    FeatureRegistry,
    FeatureSchema,
    FeatureState,
    FeatureStateReason,
    ResolvedConfig
} from "./src/types.ts";

export { featureId, FeatureNotEnabledError, FeatureNotFoundError } from "./src/types.ts";

export type { FeatureId } from "./src/types.ts";

// =============================================================================
// Errors
// =============================================================================

export {
    ConfigLoadError,
    FeatureDisabledError,
    FeatureFlagError,
    FeatureNotFoundError as FeatureNotFoundErr,
    FeatureSchemaError
} from "./src/errors.ts";

// =============================================================================
// Schema
// =============================================================================

export {
    detectCircularDependencies,
    isValidFeatureId,
    validateFeatureDefinition,
    validateSchema
} from "./src/schema.ts";

// =============================================================================
// Registry
// =============================================================================

export {
    cloneRegistry,
    createRegistry,
    getFeature,
    getFeatureState,
    listFeatures,
    registerFeature,
    setFeatureState
} from "./src/registry.ts";

export type { CreateRegistryOptions } from "./src/registry.ts";

// =============================================================================
// Evaluation
// =============================================================================

export {
    allEnabled,
    anyEnabled,
    expandFeatures,
    isEnabled,
    requireFeature
} from "./src/evaluate.ts";

// =============================================================================
// Configuration
// =============================================================================

export {
    autoLoadConfig,
    loadFromCli,
    loadFromDenoJson,
    loadFromEnv,
    loadFromPackageJson,
    mergeConfigs
} from "./src/config.ts";

