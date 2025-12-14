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
 * Regex pattern for valid feature IDs.
 * Must be lowercase alphanumeric with hyphens (kebab-case), following Cargo conventions.
 * The `/` separator is reserved for dependency feature references (e.g., "dep-name/feature").
 */
const FEATURE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Validates that a string is a valid feature ID format.
 * Feature IDs must be kebab-case (lowercase alphanumeric with hyphens).
 * The `/` separator is reserved for dependency feature references.
 *
 * @param id - The string to validate
 * @returns True if the string is a valid feature ID format
 */
export function isValidFeatureId(id: string): boolean {
  if (!id || id.length === 0) {
    return false;
  }
  // Check for leading/trailing hyphens
  if (id.startsWith("-") || id.endsWith("-")) {
    return false;
  }
  // Check for consecutive hyphens
  if (id.includes("--")) {
    return false;
  }
  // Dots are not allowed - use kebab-case
  if (id.includes(".")) {
    return false;
  }
  return FEATURE_ID_PATTERN.test(id);
}

/**
 * Creates a branded FeatureId from a string.
 * Validates the format and throws if invalid.
 *
 * @param id - The string to convert to a FeatureId
 * @returns A branded FeatureId
 * @throws Error if the format is invalid
 */
export function featureId(id: string): FeatureId {
  if (!isValidFeatureId(id)) {
    throw new FeatureIdFormatError(
      id,
      "Feature ID must be kebab-case (lowercase alphanumeric with hyphens, e.g., 'async-runtime')"
    );
  }
  return id as FeatureId;
}

/**
 * Creates a FeatureId without validation.
 * Use only when you're certain the ID is valid (e.g., from trusted internal sources).
 *
 * @param id - The string to convert to a FeatureId
 * @returns A branded FeatureId
 */
export function unsafeFeatureId(id: string): FeatureId {
  return id as FeatureId;
}

/**
 * Gets the package name from a dependency feature reference.
 * Returns undefined if this is not a dependency feature reference.
 *
 * Dependency feature references use the format: "package-name/feature-name"
 *
 * @param id - The feature reference to parse
 * @returns The package name, or undefined if not a dep reference
 *
 * @example
 * getDepPackage("lodash/clone") // returns "lodash"
 * getDepPackage("async-runtime") // returns undefined
 */
export function getDepPackage(id: string): string | undefined {
  const slashIndex = id.indexOf("/");
  if (slashIndex === -1) {
    return undefined;
  }
  return id.slice(0, slashIndex);
}

/**
 * Gets the feature name from a dependency feature reference.
 * Returns the full ID if this is not a dependency feature reference.
 *
 * @param id - The feature reference to parse
 * @returns The feature name portion
 *
 * @example
 * getDepFeature("lodash/clone") // returns "clone"
 * getDepFeature("async-runtime") // returns "async-runtime"
 */
export function getDepFeature(id: string): string {
  const slashIndex = id.indexOf("/");
  if (slashIndex === -1) {
    return id;
  }
  return id.slice(slashIndex + 1);
}

/**
 * Checks if a feature reference is a dependency feature reference.
 *
 * @param id - The feature reference to check
 * @returns True if this references a feature in a dependency
 *
 * @example
 * isDepFeatureRef("lodash/clone") // returns true
 * isDepFeatureRef("async-runtime") // returns false
 */
export function isDepFeatureRef(id: string): boolean {
  return id.includes("/");
}

/**
 * @deprecated Features are now flat (kebab-case). This function is kept for legacy compatibility.
 * Gets all ancestor feature IDs from a hierarchical feature ID.
 * Returns an empty array since features are now flat.
 *
 * @param _id - The feature ID (unused, features are flat)
 * @returns Empty array (features are flat, no hierarchy)
 */
export function getAncestorFeatureIds(_id: FeatureId): FeatureId[] {
  // Features are now flat - no hierarchy
  return [];
}

/**
 * @deprecated Features are now flat (kebab-case). This function always returns 0.
 * Gets the depth/level of a feature ID in the hierarchy.
 *
 * @param _id - The feature ID (unused, features are flat)
 * @returns Always 0 (features are flat, no hierarchy)
 */
export function getFeatureDepth(_id: FeatureId): number {
  // Features are now flat - no hierarchy
  return 0;
}

/**
 * @deprecated Features are now flat (kebab-case). This function always returns false.
 * Checks if one feature ID is an ancestor of another.
 *
 * @param _ancestor - The potential ancestor feature ID (unused)
 * @param _descendant - The potential descendant feature ID (unused)
 * @returns Always false (features are flat, no hierarchy)
 */
export function isAncestorOf(_ancestor: FeatureId, _descendant: FeatureId): boolean {
  // Features are now flat - no hierarchy
  return false;
}

/**
 * @deprecated Features are now flat (kebab-case). This function always returns false.
 * Checks if one feature ID is a descendant of another.
 *
 * @param _descendant - The potential descendant feature ID (unused)
 * @param _ancestor - The potential ancestor feature ID (unused)
 * @returns Always false (features are flat, no hierarchy)
 */
export function isDescendantOf(_descendant: FeatureId, _ancestor: FeatureId): boolean {
  // Features are now flat - no hierarchy
  return false;
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
  /** Human-readable name for the feature */
  readonly name?: string;
  /** Human-readable description of the feature */
  readonly description?: string;
  /** Parent feature ID (for hierarchical features) - computed from id if not specified */
  readonly parent?: FeatureId;
  /** Whether enabling parent automatically enables children */
  readonly cascadeToChildren?: boolean;
  /** Whether this feature is enabled by default */
  readonly defaultEnabled?: boolean;
  /** Feature metadata */
  readonly metadata?: FeatureMetadata;
}

/**
 * Input for defining a feature (before parent is computed).
 */
export interface FeatureDefinitionInput {
  /** Unique identifier for this feature */
  readonly id: string;
  /** Human-readable name for the feature */
  readonly name?: string;
  /** Human-readable description of the feature */
  readonly description?: string;
  /** Whether enabling parent automatically enables children (default: true) */
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
  /** Map of parent to children */
  readonly children: ReadonlyMap<FeatureId, readonly FeatureId[]>;
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

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error class for feature flag errors.
 */
export class FeatureFlagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureFlagError";
  }
}

/**
 * Error thrown when a feature ID format is invalid.
 */
export class FeatureIdFormatError extends FeatureFlagError {
  readonly invalidId: string;

  constructor(invalidId: string, reason?: string) {
    super(`Invalid feature ID "${invalidId}"${reason ? `: ${reason}` : ""}`);
    this.name = "FeatureIdFormatError";
    this.invalidId = invalidId;
  }
}

/**
 * Error thrown when a required feature is not enabled.
 */
export class FeatureNotEnabledError extends FeatureFlagError {
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
export class FeatureNotFoundError extends FeatureFlagError {
  readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature "${featureId}" is not defined in the schema`);
    this.name = "FeatureNotFoundError";
    this.featureId = featureId;
  }
}

/**
 * Error thrown when feature schema validation fails.
 */
export class FeatureSchemaError extends FeatureFlagError {
  constructor(message: string) {
    super(message);
    this.name = "FeatureSchemaError";
  }
}

/**
 * Error thrown when configuration loading fails.
 */
export class ConfigLoadError extends FeatureFlagError {
  readonly source?: string;

  constructor(message: string, source?: string) {
    super(message);
    this.name = "ConfigLoadError";
    this.source = source;
  }
}
