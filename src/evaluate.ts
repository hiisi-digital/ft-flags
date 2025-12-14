/**
 * Feature evaluation functions
 *
 * Provides functions to check if features are enabled.
 * Features are flat (no hierarchy) - use the manifest system for Cargo-style feature dependencies.
 *
 * @module
 */

import {
  type FeatureCheckResult,
  type FeatureId,
  FeatureNotEnabledError,
  type FeatureRegistry,
  type FeatureState,
} from "./types.ts";

/**
 * Check if a feature is enabled in the registry.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @returns true if the feature is enabled
 */
export function isEnabled(id: FeatureId, registry: FeatureRegistry): boolean {
  const state = registry.states.get(id);
  return state?.enabled ?? false;
}

/**
 * Check if a feature is disabled in the registry.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @returns true if the feature is disabled
 */
export function isDisabled(id: FeatureId, registry: FeatureRegistry): boolean {
  return !isEnabled(id, registry);
}

/**
 * Require a feature to be enabled, throwing if it's not.
 *
 * @param id - The feature ID to require
 * @param registry - The feature registry to check against
 * @throws FeatureNotEnabledError if the feature is not enabled
 */
export function requireFeature(id: FeatureId, registry: FeatureRegistry): void {
  if (!isEnabled(id, registry)) {
    const state = registry.states.get(id);

    if (state) {
      throw new FeatureNotEnabledError(id, state);
    } else {
      // Feature not in registry - create a default state for the error
      const defaultState: FeatureState = {
        enabled: false,
        reason: "default-disabled",
      };
      throw new FeatureNotEnabledError(id, defaultState);
    }
  }
}

/**
 * Get detailed information about a feature's enabled status.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @returns A FeatureCheckResult with detailed information
 */
export function checkFeature(
  id: FeatureId,
  registry: FeatureRegistry,
): FeatureCheckResult {
  const state = registry.states.get(id);

  if (!state) {
    // Feature not found, return disabled state
    return {
      enabled: false,
      featureId: id,
      state: {
        enabled: false,
        reason: "default-disabled",
      },
    };
  }

  return {
    enabled: state.enabled,
    featureId: id,
    state,
  };
}

/**
 * Check if all specified features are enabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns true if ALL features are enabled
 */
export function allEnabled(ids: FeatureId[], registry: FeatureRegistry): boolean {
  for (const id of ids) {
    if (!isEnabled(id, registry)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if any of the specified features are enabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns true if ANY feature is enabled
 */
export function anyEnabled(ids: FeatureId[], registry: FeatureRegistry): boolean {
  for (const id of ids) {
    if (isEnabled(id, registry)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if none of the specified features are enabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns true if NONE of the features are enabled
 */
export function noneEnabled(ids: FeatureId[], registry: FeatureRegistry): boolean {
  return !anyEnabled(ids, registry);
}

/**
 * Get a list of which features from the input list are enabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns Array of enabled feature IDs
 */
export function filterEnabled(
  ids: FeatureId[],
  registry: FeatureRegistry,
): FeatureId[] {
  return ids.filter((id) => isEnabled(id, registry));
}

/**
 * Get a list of which features from the input list are disabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns Array of disabled feature IDs
 */
export function filterDisabled(
  ids: FeatureId[],
  registry: FeatureRegistry,
): FeatureId[] {
  return ids.filter((id) => !isEnabled(id, registry));
}

/**
 * Count how many of the specified features are enabled.
 *
 * @param ids - The feature IDs to check
 * @param registry - The feature registry to check against
 * @returns Number of enabled features
 */
export function countEnabled(ids: FeatureId[], registry: FeatureRegistry): number {
  let count = 0;
  for (const id of ids) {
    if (isEnabled(id, registry)) {
      count++;
    }
  }
  return count;
}

/**
 * Conditionally execute a function if a feature is enabled.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @param fn - The function to execute if the feature is enabled
 * @returns The result of the function, or undefined if the feature is disabled
 */
export function whenEnabled<T>(
  id: FeatureId,
  registry: FeatureRegistry,
  fn: () => T,
): T | undefined {
  if (isEnabled(id, registry)) {
    return fn();
  }
  return undefined;
}

/**
 * Conditionally execute a function if a feature is disabled.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @param fn - The function to execute if the feature is disabled
 * @returns The result of the function, or undefined if the feature is enabled
 */
export function whenDisabled<T>(
  id: FeatureId,
  registry: FeatureRegistry,
  fn: () => T,
): T | undefined {
  if (!isEnabled(id, registry)) {
    return fn();
  }
  return undefined;
}

/**
 * Choose between two values based on whether a feature is enabled.
 *
 * @param id - The feature ID to check
 * @param registry - The feature registry to check against
 * @param enabledValue - Value to return if feature is enabled
 * @param disabledValue - Value to return if feature is disabled
 * @returns The appropriate value based on feature state
 */
export function choose<T>(
  id: FeatureId,
  registry: FeatureRegistry,
  enabledValue: T,
  disabledValue: T,
): T {
  return isEnabled(id, registry) ? enabledValue : disabledValue;
}
