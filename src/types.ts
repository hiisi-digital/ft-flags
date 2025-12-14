/**
 * @module ft-flags/types
 * Core type definitions for the feature flags system.
 */

// =============================================================================
// Feature Identifiers
// =============================================================================

/**
 * A feature identifier string, using dot-notation for hierarchy.
 * @example "shimp.fs", "shimp.env", "experimental.async"
 */
export type FeatureId = string & { readonly __brand: unique symbol };

/**
 * Creates a branded FeatureId from a string.
 * TODO: Add validation for proper dot-notation format
 */
export function featureId(id: string): FeatureId {
  // TODO: Validate format (e.g., must contain only alphanumeric and dots, no leading/trailing dots)
  return id as FeatureId;
}

// =============================================================================
// Feature Schema
// =============================================================================

/**
 * Metadata associated with a feature.
 */
export interface FeatureMetadata {
  /** Human-readable description of the feature */
  readonly description?: string;
  /** Whether this feature is experimental/unstable */
  readonly experimental?: boolean;
  /** Whether this feature is deprecated */
  readonly deprecated?: boolean;
  /** Message to show when feature is deprecated */
  readonly deprecationMessage?: string;
  /** Minimum version where this feature is available */
  readonly since?: string;
  /** Arbitrary additional metadata */
  readonly [key: string]: unknown;
}

/**
 * Definition of a single feature in the schema.
 */
export interface FeatureDefinition {
  /** Unique identifier for this feature */
  readonly id: FeatureId;
  /** Parent feature ID (for hierarchical features) */
  readonly parent?: FeatureId;
  /** Child feature IDs (computed from parent relationships) */
  readonly children?: readonly FeatureId[];
  /** Whether enabling parent automatically enables children */
  readonly cascadeToChildren?: boolean;
  /** Whether this feature is enabled by default */
  readonly defaultEnabled?: boolean;
  /** Feature metadata */
  readonly metadata?: FeatureMetadata;
}

/**
 * A complete feature schema containing all feature definitions.
 */
export interface FeatureSchema {
  /** All feature definitions, keyed by feature ID */
  readonly features: ReadonlyMap<FeatureId, FeatureDefinition>;
  /** Root features (those without parents) */
  readonly roots: readonly FeatureId[];
}

// =============================================================================
// Feature Configuration
// =============================================================================

/**
 * Configuration for which features are enabled/disabled.
 */
export interface FeatureConfig {
  /** Explicitly enabled features */
  readonly enabled?: readonly string[];
  /** Explicitly disabled features (overrides enabled) */
  readonly disabled?: readonly string[];
  /** Enable all features (can still be overridden by disabled) */
  readonly enableAll?: boolean;
  /** Disable all features by default */
  readonly disableAll?: boolean;
}

/**
 * Source from which a feature configuration was loaded.
 */
export type ConfigSource =
  | { readonly type: "deno.json"; readonly path: string }
  | { readonly type: "package.json"; readonly path: string }
  | { readonly type: "env"; readonly variable: string }
  | { readonly type: "cli"; readonly args: readonly string[] }
  | { readonly type: "programmatic" };

/**
 * Resolved configuration with source tracking.
 */
export interface ResolvedConfig {
  readonly config: FeatureConfig;
  readonly source: ConfigSource;
}

// =============================================================================
// Feature Registry
// =============================================================================

/**
 * The current evaluation state of a feature.
 */
export interface FeatureState {
  /** Whether the feature is currently enabled */
  readonly enabled: boolean;
  /** Why the feature has its current state */
  readonly reason: FeatureStateReason;
  /** Source that determined this state */
  readonly source?: ConfigSource;
}

/**
 * Reason why a feature is in its current state.
 */
export type FeatureStateReason =
  | "explicit-enabled" // Explicitly enabled in config
  | "explicit-disabled" // Explicitly disabled in config
  | "parent-enabled" // Enabled because parent was enabled with cascade
  | "parent-disabled" // Disabled because parent was disabled
  | "default-enabled" // Enabled by default in schema
  | "default-disabled" // Disabled by default (no explicit enable)
  | "enable-all" // Enabled because enableAll was set
  | "disable-all"; // Disabled because disableAll was set

/**
 * A runtime registry of features and their current states.
 * TODO: Implement as an immutable registry with efficient lookups
 */
export interface FeatureRegistry {
  /** The schema this registry is based on */
  readonly schema: FeatureSchema;
  /** Current state of each feature */
  readonly states: ReadonlyMap<FeatureId, FeatureState>;
  /** The configuration that was used to create this registry */
  readonly config: ResolvedConfig;
}

// =============================================================================
// Evaluation Types
// =============================================================================

/**
 * Result of checking if a feature is enabled.
 */
export interface FeatureCheckResult {
  readonly enabled: boolean;
  readonly featureId: FeatureId;
  readonly state: FeatureState;
}

/**
 * Error thrown when a required feature is not enabled.
 */
export class FeatureNotEnabledError extends Error {
  readonly featureId: FeatureId;
  readonly state: FeatureState;

  constructor(featureId: FeatureId, state: FeatureState) {
    super(`Feature "${featureId}" is not enabled (reason: ${state.reason})`);
    this.name = "FeatureNotEnabledError";
    this.featureId = featureId;
    this.state = state;
  }
}

/**
 * Error thrown when a feature ID is not found in the schema.
 */
export class FeatureNotFoundError extends Error {
  readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature "${featureId}" is not defined in the schema`);
    this.name = "FeatureNotFoundError";
    this.featureId = featureId;
  }
}
