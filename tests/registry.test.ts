/**
 * Tests for the feature registry
 *
 * @module
 */

import { describe, it } from "@std/testing/bdd";

// TODO: Import from ../src/registry.ts once implemented
// import { createRegistry, getFeature, setFeatureState } from "../src/registry.ts";

describe("FeatureRegistry", () => {
  describe("createRegistry", () => {
    it.skip("should create an empty registry with no options", () => {
      // TODO: Implement test
      // const registry = createRegistry();
      // assertEquals(registry.features.size, 0);
      // assertEquals(registry.states.size, 0);
    });

    it.skip("should register schemas provided in options", () => {
      // TODO: Implement test
    });

    it.skip("should enable features from options.enabled", () => {
      // TODO: Implement test
    });

    it.skip("should disable features from options.disabled", () => {
      // TODO: Implement test
    });
  });

  describe("getFeature", () => {
    it.skip("should return undefined for non-existent feature", () => {
      // TODO: Implement test
    });

    it.skip("should return feature definition for registered feature", () => {
      // TODO: Implement test
    });

    it.skip("should support dot-notation feature IDs", () => {
      // TODO: Implement test
    });
  });

  describe("setFeatureState", () => {
    it.skip("should update feature state", () => {
      // TODO: Implement test
    });

    it.skip("should propagate enabled state to children", () => {
      // TODO: Implement test
    });

    it.skip("should return a new registry instance (immutable)", () => {
      // TODO: Implement test
    });
  });

  describe("hierarchical features", () => {
    it.skip("should expand parent feature to include children", () => {
      // TODO: Implement test
      // When "shimp" is enabled, "shimp.fs" and "shimp.env" should also be enabled
    });

    it.skip("should allow disabling child even when parent is enabled", () => {
      // TODO: Implement test
    });
  });
});
