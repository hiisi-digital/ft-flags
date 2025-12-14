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
 * Must be lowercase alphanumeric with dots and hyphens, no leading/trailing dots.
 */
const FEATURE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-.]?[a-z0-9]+)*$/;

/**
 * Validates that a string is a valid feature ID format.
 *
 * @param id - The string to validate
 * @returns True if the string is a valid feature ID format
 */
export function isValidFeatureId(id: string): boolean {
  if (!id || id.length === 0) {
    return false;
  }
  // Check for leading/trailing dots or hyphens
  if (id.startsWith(".") || id.endsWith(".") || id.startsWith("-") || id.endsWith("-")) {
    return false;
  }
  // Check for consecutive dots or mixed dot-hyphen
  if (id.includes("..") || id.includes(".-") || id.includes("-.")) {
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
      "Feature ID must be lowercase alphanumeric with dots for hierarchy (e.g., 'shimp.fs')"
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
 * Gets the parent feature ID from a hierarchical feature ID.
 * Returns undefined if the feature has no parent (is a root feature).
 *
 * @param id - The feature ID to get the parent of
 * @returns The parent feature ID, or undefined if no parent
 *
 * @example
 * getParentFeatureId(featureId("shimp.fs.read")) // returns "shimp.fs"
 * getParentFeatureId(featureId("shimp")) // returns undefined
 */
export function getParentFeatureId(id: FeatureId): FeatureId | undefined {
  const lastDotIndex = (id as string).lastIndexOf(".");
  if (lastDotIndex === -1) {
    return undefined;
  }
  return (id as string).slice(0, lastDotIndex) as FeatureId;
}

/**
 * Gets all ancestor feature IDs from a hierarchical feature ID.
 * Returns an array from immediate parent to root.
 *
 * @param id - The feature ID to get ancestors of
 * @returns Array of ancestor feature IDs, from immediate parent to root
 *
 * @example
 * getAncestorFeatureIds(featureId("shimp.fs.read")) // returns ["shimp.fs", "shimp"]
 */
export function getAncestorFeatureIds(id: FeatureId): FeatureId[] {
  const ancestors: FeatureId[] = [];
  let current = getParentFeatureId(id);
  while (current !== undefined) {
    ancestors.push(current);
    current = getParentFeatureId(current);
  }
  return ancestors;
}

/**
 * Gets the depth/level of a feature ID in the hierarchy.
 * Root features have depth 0.
 *
 * @param id - The feature ID
 * @returns The depth (number of dots in the ID)
 *
 * @example
 * getFeatureDepth(featureId("shimp")) // returns 0
 * getFeatureDepth(featureId("shimp.fs")) // returns 1
 * getFeatureDepth(featureId("shimp.fs.read")) // returns 2
 */
export function getFeatureDepth(id: FeatureId): number {
  const str = id as string;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ".") {
      count++;
    }
  }
  return count;
}

/**
 * Checks if one feature ID is an ancestor of another.
 *
 * @param ancestor - The potential ancestor feature ID
 * @param descendant - The potential descendant feature ID
 * @returns True if ancestor is an ancestor of descendant
 *
 * @example
 * isAncestorOf(featureId("shimp"), featureId("shimp.fs")) // returns true
 * isAncestorOf(featureId("shimp.fs"), featureId("shimp")) // returns false
 */
export function isAncestorOf(ancestor: FeatureId, descendant: FeatureId): boolean {
  const ancestorStr = ancestor as string;
  const descendantStr = descendant as string;

  // Ancestor must be shorter
  if (ancestorStr.length >= descendantStr.length) {
    return false;
  }

  // Descendant must start with ancestor followed by a dot
  return descendantStr.startsWith(ancestorStr + ".");
}

/**
 * Checks if one feature ID is a descendant of another.
 *
 * @param descendant - The potential descendant feature ID
 * @param ancestor - The potential ancestor feature ID
 * @returns True if descendant is a descendant of ancestor
 */
export function isDescendantOf(descendant: FeatureId, ancestor: FeatureId): boolean {
  return isAncestorOf(ancestor, descendant);
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
