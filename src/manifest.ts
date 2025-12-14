/**
 * @module manifest
 * Cargo-style feature manifest loading and resolution.
 *
 * This module provides the core types and functions for working with
 * feature manifests that follow Cargo's conventions.
 *
 * Feature naming conventions (following Cargo):
 * - Feature names use kebab-case: `async-runtime`, `serde-support`
 * - `:` separates dependency feature refs: `lodash:clone`, `@scope/pkg:feature`
 * - `dep:` prefix enables optional dependencies: `dep:tokio`
 */

import {
  ConfigLoadError,
  type FeatureId,
  featureId,
  getDepFeature,
  getDepPackage,
  isDepFeatureRef,
  isValidFeatureId,
} from "./types.ts";

// =============================================================================
// Manifest Types
// =============================================================================

/**
 * A feature manifest following Cargo conventions.
 * This is the parsed representation of the `ftFlags` config section.
 */
export interface FeatureManifest {
  /**
   * Map of feature names to the features they activate.
   * The special "default" feature lists features enabled by default.
   */
  readonly features: ReadonlyMap<string, readonly string[]>;

  /**
   * Optional metadata for features.
   */
  readonly metadata: ReadonlyMap<string, FeatureManifestMetadata>;

  /**
   * The source file this manifest was loaded from.
   */
  readonly source?: ManifestSource;

  /**
   * Package dependencies (for validating dep: and pkg:feature references).
   */
  readonly dependencies?: PackageDependencies;
}

/**
 * Source information for a loaded manifest.
 */
export interface ManifestSource {
  readonly type: "deno.json" | "package.json" | "inline";
  readonly path?: string;
}

/**
 * Metadata for a feature in the manifest.
 */
export interface FeatureManifestMetadata {
  readonly description?: string;
  readonly since?: string;
  readonly unstable?: boolean;
  readonly deprecated?: boolean;
  readonly deprecatedMessage?: string;
  readonly docsUrl?: string;
  readonly requiredDeps?: readonly string[];
}

/**
 * Raw configuration as it appears in deno.json or package.json.
 */
export interface RawFtFlagsConfig {
  readonly features: Record<string, string[]>;
  readonly metadata?: Record<string, FeatureManifestMetadata>;
}

/**
 * Package dependency information for validation.
 */
export interface PackageDependencies {
  /** Regular dependencies */
  readonly dependencies?: Record<string, string>;
  /** Optional dependencies (for dep: validation) */
  readonly optionalDependencies?: Record<string, string>;
  /** Peer dependencies */
  readonly peerDependencies?: Record<string, string>;
  /** Dev dependencies */
  readonly devDependencies?: Record<string, string>;
}

/**
 * Options for manifest validation.
 */
export interface ValidateOptions {
  /**
   * Package dependencies to validate dep: and pkg:feature references against.
   * If not provided, external references are not validated.
   */
  readonly dependencies?: PackageDependencies;

  /**
   * Whether to treat unknown external dependencies as errors (default: false).
   * When false, unknown deps generate warnings instead of errors.
   */
  readonly strictDependencies?: boolean;
}

/**
 * Options for resolving features.
 */
export interface ResolveOptions {
  /**
   * Features to explicitly enable.
   */
  readonly features?: readonly string[];

  /**
   * If true, the "default" feature is not automatically enabled.
   */
  readonly noDefaultFeatures?: boolean;

  /**
   * If true, all available features are enabled.
   */
  readonly allFeatures?: boolean;
}

/**
 * Result of feature resolution.
 */
export interface ResolvedFeatures {
  /**
   * Set of all enabled feature IDs.
   */
  readonly enabled: ReadonlySet<string>;

  /**
   * Map of feature to the features that caused it to be enabled.
   */
  readonly enabledBy: ReadonlyMap<string, readonly string[]>;

  /**
   * The manifest used for resolution.
   */
  readonly manifest: FeatureManifest;

  /**
   * The options used for resolution.
   */
  readonly options: ResolveOptions;
}

/**
 * Validation result for a manifest.
 */
export interface ManifestValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Information about an external reference in the manifest.
 */
export interface ExternalReference {
  /** The feature that contains this reference */
  readonly feature: string;
  /** The full reference string */
  readonly reference: string;
  /** Type of reference: dep: prefix or pkg:feature syntax */
  readonly type: "dep" | "pkg-feature";
  /** Package name being referenced */
  readonly packageName: string;
  /** Feature name (for pkg:feature refs) */
  readonly featureName?: string;
}

// =============================================================================
// Manifest Loading
// =============================================================================

/**
 * Loads a feature manifest from deno.json.
 *
 * Features are defined at the root level of the config file.
 * Optional metadata uses the `metadata.features` namespace:
 * ```json
 * {
 *   "name": "@my/package",
 *   "features": {
 *     "default": ["std"],
 *     "std": ["fs", "env"]
 *   },
 *   "metadata": {
 *     "features": {
 *       "std": { "description": "Standard library" }
 *     }
 *   }
 * }
 * ```
 *
 * @param path - Path to deno.json (default: "./deno.json")
 * @returns The loaded manifest, or null if no features config found
 * @throws ConfigLoadError if the file cannot be read or parsed
 */
export async function loadManifestFromDenoJson(
  path?: string,
): Promise<FeatureManifest | null> {
  const configPath = path ?? "./deno.json";

  try {
    const content = await Deno.readTextFile(configPath);
    const json = JSON.parse(content) as Record<string, unknown>;

    // Features are at the root level, not nested
    const features = json.features as Record<string, string[]> | undefined;

    if (!features) {
      return null;
    }

    // Metadata follows the convention: metadata.features.{feature-name}
    const metadata = json.metadata as Record<string, unknown> | undefined;
    const featureMetadata = metadata?.features as
      | Record<string, FeatureManifestMetadata>
      | undefined;

    const rawConfig: RawFtFlagsConfig = {
      features,
      metadata: featureMetadata,
    };

    // Extract imports as dependencies for Deno
    const imports = json.imports as Record<string, string> | undefined;
    const deps: PackageDependencies | undefined = imports
      ? { dependencies: Object.fromEntries(Object.keys(imports).map((k) => [k, "*"])) }
      : undefined;

    return parseManifest(rawConfig, {
      type: "deno.json",
      path: configPath,
    }, deps);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw new ConfigLoadError(
      `Failed to load deno.json: ${error instanceof Error ? error.message : String(error)}`,
      configPath,
    );
  }
}

/**
 * Loads a feature manifest from package.json.
 *
 * Features are defined at the root level of the config file.
 * Optional metadata uses the `metadata.features` namespace:
 * ```json
 * {
 *   "name": "@my/package",
 *   "features": {
 *     "default": ["std"],
 *     "std": ["fs", "env"]
 *   },
 *   "metadata": {
 *     "features": {
 *       "std": { "description": "Standard library" }
 *     }
 *   }
 * }
 * ```
 *
 * @param path - Path to package.json (default: "./package.json")
 * @returns The loaded manifest, or null if no features config found
 * @throws ConfigLoadError if the file cannot be read or parsed
 */
export async function loadManifestFromPackageJson(
  path?: string,
): Promise<FeatureManifest | null> {
  const configPath = path ?? "./package.json";

  try {
    const content = await Deno.readTextFile(configPath);
    const json = JSON.parse(content) as Record<string, unknown>;

    // Features are at the root level, not nested
    const features = json.features as Record<string, string[]> | undefined;

    if (!features) {
      return null;
    }

    // Metadata follows the convention: metadata.features.{feature-name}
    const metadata = json.metadata as Record<string, unknown> | undefined;
    const featureMetadata = metadata?.features as
      | Record<string, FeatureManifestMetadata>
      | undefined;

    const rawConfig: RawFtFlagsConfig = {
      features,
      metadata: featureMetadata,
    };

    // Extract dependencies
    const deps: PackageDependencies = {
      dependencies: json.dependencies as Record<string, string> | undefined,
      optionalDependencies: json.optionalDependencies as Record<string, string> | undefined,
      peerDependencies: json.peerDependencies as Record<string, string> | undefined,
      devDependencies: json.devDependencies as Record<string, string> | undefined,
    };

    return parseManifest(rawConfig, {
      type: "package.json",
      path: configPath,
    }, deps);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw new ConfigLoadError(
      `Failed to load package.json: ${error instanceof Error ? error.message : String(error)}`,
      configPath,
    );
  }
}

/**
 * Auto-detects and loads a feature manifest from the current directory.
 * Tries deno.json first, then package.json.
 *
 * @returns The loaded manifest, or null if no config found
 */
export async function loadManifest(): Promise<FeatureManifest | null> {
  // Try deno.json first
  const denoManifest = await loadManifestFromDenoJson();
  if (denoManifest) {
    return denoManifest;
  }

  // Try package.json
  const packageManifest = await loadManifestFromPackageJson();
  if (packageManifest) {
    return packageManifest;
  }

  return null;
}

/**
 * Creates a manifest from a raw configuration object.
 *
 * @param config - The raw configuration
 * @param source - Optional source information
 * @param dependencies - Optional package dependencies for validation
 * @returns A parsed FeatureManifest
 */
export function parseManifest(
  config: RawFtFlagsConfig,
  source?: ManifestSource,
  dependencies?: PackageDependencies,
): FeatureManifest {
  const features = new Map<string, readonly string[]>();
  const metadata = new Map<string, FeatureManifestMetadata>();

  // Parse features
  for (const [name, deps] of Object.entries(config.features)) {
    features.set(name, Object.freeze([...deps]));
  }

  // Parse metadata
  if (config.metadata) {
    for (const [name, meta] of Object.entries(config.metadata)) {
      metadata.set(name, Object.freeze({ ...meta }));
    }
  }

  return {
    features,
    metadata,
    source,
    dependencies,
  };
}

/**
 * Creates an empty manifest.
 */
export function createEmptyManifest(): FeatureManifest {
  return {
    features: new Map(),
    metadata: new Map(),
    dependencies: undefined,
  };
}

/**
 * Creates a manifest from a simple feature list (all features independent).
 *
 * @param featureNames - Array of feature names
 * @param defaultFeatures - Features to include in "default" (optional)
 * @returns A new manifest
 */
export function createSimpleManifest(
  featureNames: string[],
  defaultFeatures?: string[],
): FeatureManifest {
  const features = new Map<string, readonly string[]>();

  // Add each feature with no dependencies
  for (const name of featureNames) {
    features.set(name, []);
  }

  // Add default if specified
  if (defaultFeatures && defaultFeatures.length > 0) {
    features.set("default", Object.freeze([...defaultFeatures]));
  }

  return {
    features,
    metadata: new Map(),
    dependencies: undefined,
  };
}

// =============================================================================
// Feature Resolution
// =============================================================================

/**
 * Resolves which features are enabled based on options.
 *
 * @param manifest - The feature manifest
 * @param options - Resolution options
 * @returns The resolved features
 */
export function resolveFeatures(
  manifest: FeatureManifest,
  options: ResolveOptions = {},
): ResolvedFeatures {
  const enabled = new Set<string>();
  const enabledBy = new Map<string, string[]>();

  // Helper to enable a feature and track why
  const enable = (feature: string, by: string): void => {
    if (!manifest.features.has(feature)) {
      // Feature doesn't exist in manifest, skip
      return;
    }

    const wasEnabled = enabled.has(feature);
    enabled.add(feature);

    // Track what enabled this feature
    const reasons = enabledBy.get(feature) ?? [];
    if (!reasons.includes(by)) {
      reasons.push(by);
      enabledBy.set(feature, reasons);
    }

    // If already enabled, don't recurse (avoid cycles)
    if (wasEnabled) {
      return;
    }

    // Enable transitive dependencies
    const deps = manifest.features.get(feature) ?? [];
    for (const dep of deps) {
      enable(dep, feature);
    }
  };

  // Enable all features if requested
  if (options.allFeatures) {
    for (const name of manifest.features.keys()) {
      enable(name, "<all-features>");
    }
  } else {
    // Enable default features unless disabled
    if (!options.noDefaultFeatures && manifest.features.has("default")) {
      enable("default", "<default>");
    }

    // Enable explicitly requested features
    if (options.features) {
      for (const feature of options.features) {
        enable(feature, "<explicit>");
      }
    }
  }

  return {
    enabled,
    enabledBy,
    manifest,
    options,
  };
}

/**
 * Checks if a feature is enabled in the resolved set.
 *
 * @param feature - The feature name to check
 * @param resolved - The resolved features
 * @returns True if the feature is enabled
 */
export function isFeatureEnabled(
  feature: string,
  resolved: ResolvedFeatures,
): boolean {
  return resolved.enabled.has(feature);
}

/**
 * Gets the chain of features that caused a feature to be enabled.
 *
 * @param feature - The feature to trace
 * @param resolved - The resolved features
 * @returns Array describing the enable chain, or null if not enabled
 */
export function getEnableChain(
  feature: string,
  resolved: ResolvedFeatures,
): string[] | null {
  if (!resolved.enabled.has(feature)) {
    return null;
  }

  const chain: string[] = [];
  const visited = new Set<string>();

  const trace = (f: string): void => {
    if (visited.has(f)) return;
    visited.add(f);
    chain.push(f);

    const enabledBy = resolved.enabledBy.get(f);
    if (enabledBy && enabledBy.length > 0) {
      // Follow the first enabler (for a simple chain)
      const firstEnabler = enabledBy[0];
      if (!firstEnabler.startsWith("<")) {
        trace(firstEnabler);
      }
    }
  };

  trace(feature);
  return chain.reverse();
}

/**
 * Lists all available features in the manifest.
 *
 * @param manifest - The feature manifest
 * @returns Array of feature names
 */
export function listAvailableFeatures(manifest: FeatureManifest): string[] {
  return [...manifest.features.keys()].sort();
}

/**
 * Lists all enabled features from a resolved set.
 *
 * @param resolved - The resolved features
 * @returns Sorted array of enabled feature names
 */
export function listEnabledFeatures(resolved: ResolvedFeatures): string[] {
  return [...resolved.enabled].sort();
}

/**
 * Lists all disabled features (available but not enabled).
 *
 * @param resolved - The resolved features
 * @returns Sorted array of disabled feature names
 */
export function listDisabledFeatures(resolved: ResolvedFeatures): string[] {
  const disabled: string[] = [];
  for (const name of resolved.manifest.features.keys()) {
    if (!resolved.enabled.has(name)) {
      disabled.push(name);
    }
  }
  return disabled.sort();
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Extracts all external references (dep: and pkg:feature) from a manifest.
 *
 * @param manifest - The manifest to analyze
 * @returns Array of external references
 */
export function extractExternalReferences(
  manifest: FeatureManifest,
): ExternalReference[] {
  const refs: ExternalReference[] = [];

  for (const [feature, deps] of manifest.features) {
    for (const dep of deps) {
      if (dep.startsWith("dep:")) {
        const packageName = dep.slice(4);
        refs.push({
          feature,
          reference: dep,
          type: "dep",
          packageName,
        });
      } else if (isDepFeatureRef(dep)) {
        const packageName = getDepPackage(dep);
        const featureName = getDepFeature(dep);
        if (packageName) {
          refs.push({
            feature,
            reference: dep,
            type: "pkg-feature",
            packageName,
            featureName,
          });
        }
      }
    }
  }

  return refs;
}

/**
 * Gets all available dependencies from a PackageDependencies object.
 */
function getAllDependencyNames(deps: PackageDependencies): Set<string> {
  const names = new Set<string>();

  if (deps.dependencies) {
    for (const name of Object.keys(deps.dependencies)) {
      names.add(name);
    }
  }
  if (deps.optionalDependencies) {
    for (const name of Object.keys(deps.optionalDependencies)) {
      names.add(name);
    }
  }
  if (deps.peerDependencies) {
    for (const name of Object.keys(deps.peerDependencies)) {
      names.add(name);
    }
  }
  if (deps.devDependencies) {
    for (const name of Object.keys(deps.devDependencies)) {
      names.add(name);
    }
  }

  return names;
}

/**
 * Validates a feature reference (dependency within a feature's activation list).
 *
 * @param ref - The reference string to validate
 * @param featureName - The feature containing this reference
 * @param allFeatures - Set of all local feature names
 * @returns Error message if invalid, null if valid
 */
function validateFeatureReference(
  ref: string,
  featureName: string,
  allFeatures: Set<string>,
): string | null {
  // dep: prefix for optional dependencies
  if (ref.startsWith("dep:")) {
    const depName = ref.slice(4);
    if (!depName || depName.length === 0) {
      return `Feature "${featureName}" has invalid dep: reference "${ref}": missing package name`;
    }
    if (!isValidPackageName(depName)) {
      return `Feature "${featureName}" has invalid dep: reference "${ref}": "${depName}" is not a valid package name`;
    }
    return null; // Valid format (actual dep check is separate)
  }

  // Dependency feature reference (pkg:feature)
  if (isDepFeatureRef(ref)) {
    const pkg = getDepPackage(ref);
    const feature = getDepFeature(ref);

    if (!pkg) {
      return `Feature "${featureName}" has invalid external reference "${ref}": missing package name`;
    }
    if (!feature) {
      return `Feature "${featureName}" has invalid external reference "${ref}": missing feature name`;
    }
    if (!isValidPackageName(pkg)) {
      return `Feature "${featureName}" has invalid external reference "${ref}": "${pkg}" is not a valid package name`;
    }
    if (!isValidFeatureId(feature)) {
      return `Feature "${featureName}" has invalid external reference "${ref}": "${feature}" is not a valid feature name (must be kebab-case)`;
    }
    return null; // Valid format
  }

  // Local feature reference
  if (!allFeatures.has(ref)) {
    return `Feature "${featureName}" references unknown feature "${ref}"`;
  }

  return null;
}

/**
 * Validates a feature manifest.
 *
 * @param manifest - The manifest to validate
 * @param options - Optional validation options
 * @returns Validation result with errors and warnings
 */
export function validateManifest(
  manifest: FeatureManifest,
  options?: ValidateOptions,
): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allFeatures = new Set(manifest.features.keys());
  const availableDeps = options?.dependencies ? getAllDependencyNames(options.dependencies) : null;

  // Validate each feature
  for (const [name, deps] of manifest.features) {
    // Validate feature name format
    if (!isValidFeatureIdOrDefault(name)) {
      errors.push(
        `Invalid feature name "${name}": must be kebab-case (e.g., 'async-runtime')`,
      );
    }

    // Check for self-reference
    if (deps.includes(name)) {
      errors.push(`Feature "${name}" references itself`);
    }

    // Validate each dependency reference
    for (const dep of deps) {
      const refError = validateFeatureReference(dep, name, allFeatures);
      if (refError) {
        errors.push(refError);
      }
    }
  }

  // Check for circular dependencies
  const cycles = detectCycles(manifest);
  for (const cycle of cycles) {
    errors.push(`Circular dependency detected: ${cycle.join(" -> ")}`);
  }

  // Validate external references against actual dependencies if provided
  if (availableDeps) {
    const externalRefs = extractExternalReferences(manifest);
    for (const ref of externalRefs) {
      if (!availableDeps.has(ref.packageName)) {
        const message =
          `Feature "${ref.feature}" references non-existent dependency "${ref.packageName}" via "${ref.reference}"`;
        if (options?.strictDependencies) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    }
  }

  // Validate metadata references
  for (const name of manifest.metadata.keys()) {
    if (!allFeatures.has(name)) {
      warnings.push(`Metadata defined for unknown feature "${name}"`);
    }
  }

  // Check for deprecated features without messages
  for (const [name, meta] of manifest.metadata) {
    if (meta.deprecated && !meta.deprecatedMessage) {
      warnings.push(
        `Feature "${name}" is marked deprecated but has no deprecation message`,
      );
    }
  }

  // Warn if no default feature
  if (!manifest.features.has("default")) {
    warnings.push(
      'No "default" feature defined. Consider adding one for conventional usage.',
    );
  }

  // Warn about empty default
  const defaultDeps = manifest.features.get("default");
  if (defaultDeps && defaultDeps.length === 0) {
    warnings.push(
      'The "default" feature enables no other features. Consider adding features to it.',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a feature name (used for feature declarations, not references).
 * - "default" is always valid (special case)
 * - Regular features must be kebab-case
 * - dep: and pkg:feature are NOT valid as feature names (only as references)
 */
function isValidFeatureIdOrDefault(name: string): boolean {
  if (name === "default") {
    return true;
  }

  // dep: prefix is NOT valid for feature names - only for references
  if (name.startsWith("dep:")) {
    return false;
  }

  // pkg:feature is NOT valid for feature names - only for references
  if (isDepFeatureRef(name)) {
    return false;
  }

  return isValidFeatureId(name);
}

/**
 * Validates a package name (allows scoped packages like @scope/name).
 *
 * @param name - The package name to validate
 * @returns True if the package name is valid
 */
export function isValidPackageName(name: string): boolean {
  if (!name || name.length === 0) {
    return false;
  }

  // Scoped package: @scope/name
  if (name.startsWith("@")) {
    const parts = name.slice(1).split("/");
    if (parts.length !== 2) return false;
    return parts.every((p) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(p));
  }

  // Regular package name (kebab-case)
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

/**
 * Validates a feature reference string format.
 * This checks syntax only, not whether the referenced feature/package exists.
 *
 * @param ref - The reference to validate
 * @returns True if the reference has valid format
 */
export function isValidFeatureReference(ref: string): boolean {
  if (!ref || ref.length === 0) {
    return false;
  }

  // dep: prefix
  if (ref.startsWith("dep:")) {
    const depName = ref.slice(4);
    return isValidPackageName(depName);
  }

  // pkg:feature reference
  if (isDepFeatureRef(ref)) {
    const pkg = getDepPackage(ref);
    const feature = getDepFeature(ref);
    if (!pkg || !feature) return false;
    return isValidPackageName(pkg) && isValidFeatureId(feature);
  }

  // Local feature reference or "default"
  return ref === "default" || isValidFeatureId(ref);
}

/**
 * Detects circular dependencies in the manifest.
 *
 * @param manifest - The manifest to check
 * @returns Array of cycles found (each cycle is an array of feature names)
 */
export function detectCycles(manifest: FeatureManifest): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const dfs = (node: string, path: string[]): void => {
    if (inStack.has(node)) {
      // Found a cycle - extract it
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart);
      cycle.push(node);
      cycles.push(cycle);
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = manifest.features.get(node) ?? [];
    for (const dep of deps) {
      if (!dep.startsWith("dep:") && manifest.features.has(dep)) {
        dfs(dep, [...path]);
      }
    }

    inStack.delete(node);
  };

  for (const name of manifest.features.keys()) {
    dfs(name, []);
  }

  return cycles;
}

// =============================================================================
// Feature Tree
// =============================================================================

/**
 * A node in the feature dependency tree.
 */
export interface FeatureTreeNode {
  readonly name: string;
  readonly children: readonly FeatureTreeNode[];
  readonly isCircular?: boolean;
}

/**
 * Builds a dependency tree for visualization.
 *
 * @param manifest - The feature manifest
 * @param root - Optional root feature (if omitted, shows all roots)
 * @returns Array of tree nodes
 */
export function buildFeatureTree(
  manifest: FeatureManifest,
  root?: string,
): FeatureTreeNode[] {
  const buildNode = (name: string, visited: Set<string>): FeatureTreeNode => {
    if (visited.has(name)) {
      return {
        name,
        children: [],
        isCircular: true,
      };
    }

    const deps = manifest.features.get(name) ?? [];
    const nextVisited = new Set(visited);
    nextVisited.add(name);

    const children: FeatureTreeNode[] = [];
    for (const dep of deps) {
      if (!dep.startsWith("dep:") && manifest.features.has(dep)) {
        children.push(buildNode(dep, nextVisited));
      }
    }

    return {
      name,
      children,
    };
  };

  if (root) {
    if (!manifest.features.has(root)) {
      return [];
    }
    return [buildNode(root, new Set())];
  }

  // Build trees for all root features (not referenced by others)
  const referenced = new Set<string>();
  for (const deps of manifest.features.values()) {
    for (const dep of deps) {
      referenced.add(dep);
    }
  }

  const roots: FeatureTreeNode[] = [];
  for (const name of manifest.features.keys()) {
    // A root is a feature that isn't referenced by any other feature
    // (or is "default")
    if (!referenced.has(name) || name === "default") {
      roots.push(buildNode(name, new Set()));
    }
  }

  return roots;
}

/**
 * Renders a feature tree as a string for display.
 *
 * @param nodes - The tree nodes to render
 * @param indent - Current indentation (for recursion)
 * @returns Formatted tree string
 */
export function renderFeatureTree(
  nodes: readonly FeatureTreeNode[],
  indent: string = "",
): string {
  const lines: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const prefix = isLast ? "`-- " : "|-- ";
    const childIndent = isLast ? "    " : "|   ";

    let line = indent + prefix + node.name;
    if (node.isCircular) {
      line += " (circular)";
    }
    lines.push(line);

    if (node.children.length > 0 && !node.isCircular) {
      lines.push(renderFeatureTree(node.children, indent + childIndent));
    }
  }

  return lines.join("\n");
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Converts resolved features to FeatureId set for use with registry.
 *
 * @param resolved - The resolved features
 * @returns Set of FeatureId values
 */
export function toFeatureIdSet(resolved: ResolvedFeatures): Set<FeatureId> {
  const ids = new Set<FeatureId>();
  for (const name of resolved.enabled) {
    if (isValidFeatureId(name)) {
      ids.add(featureId(name));
    }
  }
  return ids;
}

/**
 * Creates a manifest from resolved features (for serialization).
 *
 * @param resolved - The resolved features to serialize
 * @returns A raw config object suitable for JSON serialization
 */
export function toRawConfig(manifest: FeatureManifest): RawFtFlagsConfig {
  const features: Record<string, string[]> = {};
  const metadata: Record<string, FeatureManifestMetadata> = {};

  for (const [name, deps] of manifest.features) {
    features[name] = [...deps];
  }

  for (const [name, meta] of manifest.metadata) {
    metadata[name] = { ...meta };
  }

  return {
    features,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
