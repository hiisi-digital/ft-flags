/**
 * Error types for ft-flags
 * @module
 */

/**
 * Base error class for feature flag errors
 */
export class FeatureFlagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureFlagError";
  }
}

/**
 * Error thrown when a feature is not found in the registry
 *
 * TODO: Include feature ID and available features in error message
 */
export class FeatureNotFoundError extends FeatureFlagError {
  constructor(public readonly featureId: string) {
    super(`Feature not found: ${featureId}`);
    this.name = "FeatureNotFoundError";
  }
}

/**
 * Error thrown when a required feature is disabled
 *
 * TODO: Include context about why the feature is disabled
 */
export class FeatureDisabledError extends FeatureFlagError {
  constructor(public readonly featureId: string) {
    super(`Feature is disabled: ${featureId}`);
    this.name = "FeatureDisabledError";
  }
}

/**
 * Error thrown when feature schema validation fails
 *
 * TODO: Include detailed validation error messages
 */
export class FeatureSchemaError extends FeatureFlagError {
  constructor(message: string) {
    super(message);
    this.name = "FeatureSchemaError";
  }
}

/**
 * Error thrown when configuration loading fails
 *
 * TODO: Include config source path and parse errors
 */
export class ConfigLoadError extends FeatureFlagError {
  constructor(
    message: string,
    public readonly source?: string,
  ) {
    super(message);
    this.name = "ConfigLoadError";
  }
}
