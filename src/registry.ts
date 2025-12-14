/**
 * Feature registry implementation
 *
 * The registry holds all registered features and their current enable/disable state.
 * Features are flat (no hierarchy) - use the manifest system for Cargo-style feature dependencies.
 *
 * @module
 */

import { buildSchema, createEmptySchema } from "./schema.ts";
import {
    type FeatureConfig,
    type FeatureDefinition,
    type FeatureId,
    type FeatureRegistry,
    type FeatureSchema,
    type FeatureState,
    type FeatureStateReason,
    type ResolvedConfig,
    featureId,
    FeatureNotFoundError,
} from "./types.ts";

/**
 * Options for creating a feature registry
 */
export interface CreateRegistryOptions {
  /** Feature schema to use */
  readonly schema?: FeatureSchema;
  /** Feature configuration */
  readonly config?: FeatureConfig;
  /** Source of the configuration */
  readonly configSource?: ResolvedConfig["source"];
}

/**
 * Creates a new feature registry from a schema and configuration.
 *
 * @param options - Registry creation options
 * @returns A new FeatureRegistry
 */
export function createRegistry(options?: CreateRegistryOptions): FeatureRegistry {
  const schema = options?.schema ?? createEmptySchema();
  const config = options?.config ?? {};
  const configSource = options?.configSource ?? { type: "programmatic" as const };

  const states = new Map<FeatureId, FeatureState>();

  // Initialize all features to their default states
  for (const [id, definition] of schema.features) {
    states.set(id, computeInitialState(definition, config, schema));
  }

  // Apply explicit enables (with cascade)
  if (config.enabled) {
    for (const idStr of config.enabled) {
      try {
        const id = featureId(idStr);
        applyEnable(id, states, schema, configSource, "explicit-enabled");
      } catch {
        // Skip invalid feature IDs
      }
    }
  }

  // Apply explicit disables (overrides enables, with cascade)
  if (config.disabled) {
    for (const idStr of config.disabled) {
      try {
        const id = featureId(idStr);
        applyDisable(id, states, schema, configSource, "explicit-disabled");
      } catch {
        // Skip invalid feature IDs
      }
    }
  }

  return {
    schema,
    states,
    config: {
      config,
      source: configSource,
    },
  };
}

/**
 * Computes the initial state for a feature based on defaults and config.
 */
function computeInitialState(
  definition: FeatureDefinition,
  config: FeatureConfig,
  _schema: FeatureSchema
): FeatureState {
  // Check enableAll/disableAll first
  if (config.enableAll) {
    return {
      enabled: true,
      reason: "enable-all",
    };
  }

  if (config.disableAll) {
    return {
      enabled: false,
      reason: "disable-all",
    };
  }

  // Check default from definition
  if (definition.defaultEnabled) {
    return {
      enabled: true,
      reason: "default-enabled",
    };
  }

  return {
    enabled: false,
    reason: "default-disabled",
  };
}

/**
 * Applies an enable to a feature.
 * Features are flat - no cascading to children.
 */
function applyEnable(
  id: FeatureId,
  states: Map<FeatureId, FeatureState>,
  _schema: FeatureSchema,
  source: ResolvedConfig["source"],
  reason: FeatureStateReason
): void {
  // Set the feature state
  states.set(id, {
    enabled: true,
    reason,
    source,
  });
}

/**
 * Applies a disable to a feature.
 * Features are flat - no cascading to children.
 */
function applyDisable(
  id: FeatureId,
  states: Map<FeatureId, FeatureState>,
  _schema: FeatureSchema,
  source: ResolvedConfig["source"],
  reason: FeatureStateReason
): void {
  // Set the feature state
  states.set(id, {
    enabled: false,
    reason,
    source,
  });
}

/**
 * Gets a feature definition from the registry's schema.
 *
 * @param registry - The feature registry
 * @param id - The feature ID to look up
 * @returns The feature definition, or undefined if not found
 */
export function getFeature(
  registry: FeatureRegistry,
  id: FeatureId
): FeatureDefinition | undefined {
  return registry.schema.features.get(id);
}

/**
 * Gets the current state of a feature.
 *
 * @param registry - The feature registry
 * @param id - The feature ID to look up
 * @returns The feature state, or undefined if not registered
 */
export function getFeatureState(
  registry: FeatureRegistry,
  id: FeatureId
): FeatureState | undefined {
  return registry.states.get(id);
}

/**
 * Checks if a feature is enabled.
 *
 * @param registry - The feature registry
 * @param id - The feature ID to check
 * @returns True if the feature is enabled
 */
export function isEnabled(registry: FeatureRegistry, id: FeatureId): boolean {
  const state = registry.states.get(id);
  return state?.enabled ?? false;
}

/**
 * Checks if a feature is disabled.
 *
 * @param registry - The feature registry
 * @param id - The feature ID to check
 * @returns True if the feature is disabled
 */
export function isDisabled(registry: FeatureRegistry, id: FeatureId): boolean {
  return !isEnabled(registry, id);
}

/**
 * Requires a feature to be enabled, throwing if it's not.
 *
 * @param registry - The feature registry
 * @param id - The feature ID to require
 * @throws FeatureNotEnabledError if the feature is not enabled
 */
export function requireFeature(registry: FeatureRegistry, id: FeatureId): void {
  if (!isEnabled(registry, id)) {
    throw new FeatureNotFoundError(id as string);
  }
}

/**
 * Sets the state of a feature, returning a new registry.
 * This is an immutable operation.
 *
 * @param registry - The current registry
 * @param id - The feature ID to update
 * @param enabled - Whether the feature should be enabled
 * @returns A new registry with the updated state
 */
export function setFeatureState(
  registry: FeatureRegistry,
  id: FeatureId,
  enabled: boolean
): FeatureRegistry {
  const newStates = new Map(registry.states);

  const reason: FeatureStateReason = enabled ? "explicit-enabled" : "explicit-disabled";

  if (enabled) {
    applyEnable(id, newStates, registry.schema, { type: "programmatic" }, reason);
  } else {
    applyDisable(id, newStates, registry.schema, { type: "programmatic" }, reason);
  }

  return {
    schema: registry.schema,
    states: newStates,
    config: registry.config,
  };
}

/**
 * Enables a feature, returning a new registry.
 *
 * @param registry - The current registry
 * @param id - The feature ID to enable
 * @returns A new registry with the feature enabled
 */
export function enableFeature(registry: FeatureRegistry, id: FeatureId): FeatureRegistry {
  return setFeatureState(registry, id, true);
}

/**
 * Disables a feature, returning a new registry.
 *
 * @param registry - The current registry
 * @param id - The feature ID to disable
 * @returns A new registry with the feature disabled
 */
export function disableFeature(registry: FeatureRegistry, id: FeatureId): FeatureRegistry {
  return setFeatureState(registry, id, false);
}

/**
 * Lists all registered feature IDs.
 *
 * @param registry - The feature registry
 * @returns Array of all feature IDs
 */
export function listFeatures(registry: FeatureRegistry): FeatureId[] {
  return [...registry.schema.features.keys()];
}

/**
 * Lists all enabled feature IDs.
 *
 * @param registry - The feature registry
 * @returns Array of enabled feature IDs
 */
export function listEnabledFeatures(registry: FeatureRegistry): FeatureId[] {
  const enabled: FeatureId[] = [];
  for (const [id, state] of registry.states) {
    if (state.enabled) {
      enabled.push(id);
    }
  }
  return enabled;
}

/**
 * Lists all disabled feature IDs.
 *
 * @param registry - The feature registry
 * @returns Array of disabled feature IDs
 */
export function listDisabledFeatures(registry: FeatureRegistry): FeatureId[] {
  const disabled: FeatureId[] = [];
  for (const [id, state] of registry.states) {
    if (!state.enabled) {
      disabled.push(id);
    }
  }
  return disabled;
}

/**
 * Clones a registry.
 *
 * @param registry - The registry to clone
 * @returns A new registry with the same state
 */
export function cloneRegistry(registry: FeatureRegistry): FeatureRegistry {
  return {
    schema: registry.schema,
    states: new Map(registry.states),
    config: registry.config,
  };
}

/**
 * Creates a registry with features enabled based on a set of IDs.
 *
 * @param featureIds - Array of feature ID strings to enable
 * @returns A new registry with those features enabled
 */
export function createSimpleRegistry(featureIds: string[]): FeatureRegistry {
  // Create definitions for each feature
  const definitions = featureIds.map((id) => ({ id }));

  // Build schema
  const schema = buildSchema(definitions);

  // Create registry with all features enabled
  return createRegistry({
    schema,
    config: {
      enabled: featureIds,
    },
  });
}

/**
 * Merges two registries together.
 * The override registry's state takes precedence.
 *
 * @param base - The base registry
 * @param override - The registry to merge on top
 * @returns A new merged registry
 */
export function mergeRegistries(
  base: FeatureRegistry,
  override: FeatureRegistry
): FeatureRegistry {
  // Merge schemas (override takes precedence for same IDs)
  const allFeatures = new Map<FeatureId, FeatureDefinition>();
  for (const [id, def] of base.schema.features) {
    allFeatures.set(id, def);
  }
  for (const [id, def] of override.schema.features) {
    allFeatures.set(id, def);
  }

  // Rebuild schema from merged features
  const definitions = [...allFeatures.values()].map((def) => ({
    id: def.id as string,
    name: def.name,
    description: def.description,
    cascadeToChildren: def.cascadeToChildren,
    defaultEnabled: def.defaultEnabled,
    metadata: def.metadata,
  }));

  const schema = buildSchema(definitions);

  // Merge states (override takes precedence)
  const states = new Map<FeatureId, FeatureState>();
  for (const [id, state] of base.states) {
    states.set(id, state);
  }
  for (const [id, state] of override.states) {
    states.set(id, state);
  }

  return {
    schema,
    states,
    config: override.config,
  };
}
