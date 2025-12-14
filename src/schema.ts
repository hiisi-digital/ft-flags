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
    getParentFeatureId,
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
      `Invalid feature ID "${id}": must be lowercase alphanumeric with dots for hierarchy (e.g., 'shimp.fs')`
    );
  }

  // Warn about very long IDs
  if (id.length > 64) {
    warnings.push(`Feature ID "${id}" is very long (${id.length} chars), consider shortening`);
  }

  // Warn about deeply nested IDs
  const depth = id.split(".").length - 1;
  if (depth > 5) {
    warnings.push(`Feature ID "${id}" is deeply nested (${depth} levels), consider flattening`);
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

  // Check parent references
  for (const def of definitions) {
    if (!isValidFeatureId(def.id)) continue;

    const parentId = getParentFeatureId(featureId(def.id));
    if (parentId && !seenIds.has(parentId as string)) {
      // Parent is implied by the ID but not explicitly defined
      // This is actually okay - we'll create implicit parents
      // But warn about it
      warnings.push(
        `Feature "${def.id}" implies parent "${parentId}" which is not explicitly defined`
      );
    }
  }

  // Check for circular dependencies (shouldn't be possible with dot notation, but check anyway)
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
 * With dot-notation hierarchy, circular dependencies shouldn't be possible,
 * but this function validates that invariant.
 *
 * @param definitions - Array of feature definitions to check
 * @returns Array of circular dependency path descriptions
 */
export function detectCircularDependencies(definitions: FeatureDefinitionInput[]): string[] {
  const circularPaths: string[] = [];

  // Build a map of ID to definition
  const definitionMap = new Map<string, FeatureDefinitionInput>();
  for (const def of definitions) {
    definitionMap.set(def.id, def);
  }

  // For each feature, walk up its parent chain looking for cycles
  for (const def of definitions) {
    if (!isValidFeatureId(def.id)) continue;

    const visited = new Set<string>();
    const path: string[] = [def.id];
    visited.add(def.id);

    let currentId: FeatureId | undefined = featureId(def.id);
    while (currentId) {
      const parentId = getParentFeatureId(currentId);
      if (!parentId) break;

      const parentStr = parentId as string;
      if (visited.has(parentStr)) {
        // This shouldn't happen with dot notation, but check anyway
        circularPaths.push(`${path.join(" -> ")} -> ${parentStr}`);
        break;
      }

      visited.add(parentStr);
      path.push(parentStr);
      currentId = parentId;
    }
  }

  return circularPaths;
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

  // First pass: create all feature definitions
  for (const input of definitions) {
    const id = featureId(input.id);
    const parentId = getParentFeatureId(id);

    const definition: FeatureDefinition = {
      id,
      name: input.name,
      description: input.description,
      parent: parentId,
      cascadeToChildren: input.cascadeToChildren ?? true,
      defaultEnabled: input.defaultEnabled ?? false,
      metadata: input.metadata,
    };

    features.set(id, definition);

    // Track roots
    if (!parentId) {
      roots.push(id);
    }
  }

  // Second pass: build children map
  for (const [id, def] of features) {
    if (def.parent) {
      const siblings = childrenMap.get(def.parent) ?? [];
      siblings.push(id);
      childrenMap.set(def.parent, siblings);
    }
  }

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
