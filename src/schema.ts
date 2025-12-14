/**
 * Feature flag schema validation.
 *
 * Provides functions to validate feature schemas and definitions,
 * detect circular dependencies, and build schema structures.
 *
 * @module
 */

import {
    type FeatureDefinition,
    type FeatureDefinitionInput,
    type FeatureId,
    type FeatureSchema,
    featureId,
    FeatureSchemaError,
    isValidFeatureId,
} from "./types.ts";

/**
 * Validation result for schema validation.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Creates an empty validation result.
 */
export function createEmptyValidationResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Merges multiple validation results into one.
 */
export function mergeValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a feature ID format.
 *
 * @param id - The feature ID string to validate
 * @returns Validation result
 */
export function validateFeatureId(id: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!id || id.trim().length === 0) {
    errors.push("Feature ID cannot be empty");
    return { valid: false, errors, warnings };
  }

  if (!isValidFeatureId(id)) {
    errors.push(
      `Invalid feature ID "${id}": must be kebab-case (e.g., 'async-runtime')`
    );
  }

  // Warn about very long IDs
  if (id.length > 64) {
    warnings.push(`Feature ID "${id}" is very long (${id.length} chars), consider shortening`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a single feature definition.
 *
 * @param definition - The feature definition to validate
 * @returns Validation result
 */
export function validateFeatureDefinition(
  definition: FeatureDefinitionInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate the ID
  const idResult = validateFeatureId(definition.id);
  errors.push(...idResult.errors);
  warnings.push(...idResult.warnings);

  // Validate metadata if present
  if (definition.metadata) {
    if (definition.metadata.deprecated && !definition.metadata.deprecationMessage) {
      warnings.push(
        `Feature "${definition.id}" is marked deprecated but has no deprecation message`
      );
    }

    if (definition.metadata.since) {
      // Basic semver-ish check
      if (!/^\d+\.\d+/.test(definition.metadata.since)) {
        warnings.push(
          `Feature "${definition.id}" has an unusual 'since' version format: "${definition.metadata.since}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a complete feature schema.
 *
 * @param definitions - Array of feature definitions to validate as a schema
 * @returns Validation result
 */
export function validateSchema(definitions: FeatureDefinitionInput[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  // Validate each definition
  for (const def of definitions) {
    const defResult = validateFeatureDefinition(def);
    errors.push(...defResult.errors);
    warnings.push(...defResult.warnings);

    // Check for duplicates
    if (seenIds.has(def.id)) {
      errors.push(`Duplicate feature ID: "${def.id}"`);
    }
    seenIds.add(def.id);
  }

  // Check for circular dependencies
  const circularPaths = detectCircularDependencies(definitions);
  for (const path of circularPaths) {
    errors.push(`Circular dependency detected: ${path}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detects circular dependencies in feature definitions.
 * With flat features, this is a no-op since there's no hierarchy.
 * Kept for API compatibility with the legacy schema system.
 *
 * @param _definitions - Array of feature definitions to check (unused)
 * @returns Empty array (flat features have no hierarchy to create cycles)
 */
export function detectCircularDependencies(_definitions: FeatureDefinitionInput[]): string[] {
  // Flat features have no parent-child hierarchy, so no cycles are possible
  // Circular dependencies in the manifest system are handled by manifest.ts
  return [];
}

/**
 * Builds a FeatureSchema from an array of feature definition inputs.
 *
 * @param definitions - Array of feature definitions
 * @returns A complete FeatureSchema
 * @throws FeatureSchemaError if validation fails
 */
export function buildSchema(definitions: FeatureDefinitionInput[]): FeatureSchema {
  // Validate first
  const validation = validateSchema(definitions);
  if (!validation.valid) {
    throw new FeatureSchemaError(
      `Schema validation failed:\n${validation.errors.join("\n")}`
    );
  }

  // Build the feature map
  const features = new Map<FeatureId, FeatureDefinition>();
  const childrenMap = new Map<FeatureId, FeatureId[]>();
  const roots: FeatureId[] = [];

  // Create all feature definitions (flat, no parent-child hierarchy)
  for (const input of definitions) {
    const id = featureId(input.id);

    const definition: FeatureDefinition = {
      id,
      name: input.name,
      description: input.description,
      parent: undefined, // Flat features have no parent
      cascadeToChildren: input.cascadeToChildren ?? true,
      defaultEnabled: input.defaultEnabled ?? false,
      metadata: input.metadata,
    };

    features.set(id, definition);

    // All features are roots in flat model
    roots.push(id);
  }

  // No children map needed for flat features

  // Convert children map to readonly
  const children = new Map<FeatureId, readonly FeatureId[]>();
  for (const [parentId, childIds] of childrenMap) {
    children.set(parentId, Object.freeze([...childIds]));
  }

  return {
    features,
    roots: Object.freeze([...roots]),
    children,
  };
}

/**
 * Creates an empty schema.
 */
export function createEmptySchema(): FeatureSchema {
  return {
    features: new Map(),
    roots: [],
    children: new Map(),
  };
}

/**
 * Gets all child feature IDs for a given feature (direct children only).
 *
 * @param schema - The feature schema
 * @param id - The feature ID to get children for
 * @returns Array of child feature IDs
 */
export function getChildFeatureIds(schema: FeatureSchema, id: FeatureId): readonly FeatureId[] {
  return schema.children.get(id) ?? [];
}

/**
 * Gets all descendant feature IDs for a given feature (recursive).
 *
 * @param schema - The feature schema
 * @param id - The feature ID to get descendants for
 * @returns Array of all descendant feature IDs
 */
export function getDescendantFeatureIds(schema: FeatureSchema, id: FeatureId): FeatureId[] {
  const descendants: FeatureId[] = [];
  const queue = [...(schema.children.get(id) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    descendants.push(current);
    const children = schema.children.get(current);
    if (children) {
      queue.push(...children);
    }
  }

  return descendants;
}

/**
 * Merges two schemas together.
 * Later definitions override earlier ones with the same ID.
 *
 * @param base - The base schema
 * @param override - The schema to merge on top
 * @returns A new merged schema
 */
export function mergeSchemas(base: FeatureSchema, override: FeatureSchema): FeatureSchema {
  // Collect all definitions
  const allDefinitions: FeatureDefinitionInput[] = [];

  // Add base definitions
  for (const [, def] of base.features) {
    allDefinitions.push({
      id: def.id as string,
      name: def.name,
      description: def.description,
      cascadeToChildren: def.cascadeToChildren,
      defaultEnabled: def.defaultEnabled,
      metadata: def.metadata,
    });
  }

  // Add/override with new definitions
  const seenIds = new Set(allDefinitions.map((d) => d.id));
  for (const [, def] of override.features) {
    const idStr = def.id as string;
    if (seenIds.has(idStr)) {
      // Override existing
      const index = allDefinitions.findIndex((d) => d.id === idStr);
      allDefinitions[index] = {
        id: idStr,
        name: def.name,
        description: def.description,
        cascadeToChildren: def.cascadeToChildren,
        defaultEnabled: def.defaultEnabled,
        metadata: def.metadata,
      };
    } else {
      allDefinitions.push({
        id: idStr,
        name: def.name,
        description: def.description,
        cascadeToChildren: def.cascadeToChildren,
        defaultEnabled: def.defaultEnabled,
        metadata: def.metadata,
      });
    }
  }

  return buildSchema(allDefinitions);
}
