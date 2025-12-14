/**
 * Tests for the feature registry
 *
 * @module
 */

import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
    cloneRegistry,
    createRegistry,
    createSimpleRegistry,
    disableFeature,
    enableFeature,
    getFeature,
    getFeatureState,
    isDisabled,
    isEnabled,
    listDisabledFeatures,
    listEnabledFeatures,
    listFeatures,
    requireFeature,
    setFeatureState,
} from "../src/registry.ts";
import { buildSchema } from "../src/schema.ts";
import { featureId } from "../src/types.ts";

describe("FeatureRegistry", () => {
  describe("createRegistry", () => {
    it("should create an empty registry with no options", () => {
      const registry = createRegistry();
      assertEquals(registry.schema.features.size, 0);
      assertEquals(registry.states.size, 0);
    });

    it("should create registry with schema", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
      ]);
      const registry = createRegistry({ schema });

      assertEquals(registry.schema.features.size, 2);
      assertEquals(registry.states.size, 2);
    });

    it("should enable features from config.enabled", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
      ]);
      const registry = createRegistry({
        schema,
        config: {
          enabled: ["feature-a"],
        },
      });

      assertEquals(isEnabled(registry, featureId("feature-a")), true);
      assertEquals(isEnabled(registry, featureId("feature-b")), false);
    });

    it("should disable features from config.disabled", () => {
      const schema = buildSchema([
        { id: "feature-a", defaultEnabled: true },
        { id: "feature-b", defaultEnabled: true },
      ]);
      const registry = createRegistry({
        schema,
        config: {
          disabled: ["feature-a"],
        },
      });

      assertEquals(isEnabled(registry, featureId("feature-a")), false);
      assertEquals(isEnabled(registry, featureId("feature-b")), true);
    });

    it("should respect enableAll config", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
      ]);
      const registry = createRegistry({
        schema,
        config: {
          enableAll: true,
        },
      });

      assertEquals(isEnabled(registry, featureId("feature-a")), true);
      assertEquals(isEnabled(registry, featureId("feature-b")), true);
    });

    it("should respect disableAll config", () => {
      const schema = buildSchema([
        { id: "feature-a", defaultEnabled: true },
        { id: "feature-b", defaultEnabled: true },
      ]);
      const registry = createRegistry({
        schema,
        config: {
          disableAll: true,
        },
      });

      assertEquals(isEnabled(registry, featureId("feature-a")), false);
      assertEquals(isEnabled(registry, featureId("feature-b")), false);
    });
  });

  describe("getFeature", () => {
    it("should return undefined for non-existent feature", () => {
      const registry = createRegistry();
      const feature = getFeature(registry, featureId("nonexistent"));
      assertEquals(feature, undefined);
    });

    it("should return feature definition for registered feature", () => {
      const schema = buildSchema([
        { id: "my-feature", description: "Test feature" },
      ]);
      const registry = createRegistry({ schema });

      const feature = getFeature(registry, featureId("my-feature"));
      assertEquals(feature?.id, featureId("my-feature"));
      assertEquals(feature?.description, "Test feature");
    });
  });

  describe("getFeatureState", () => {
    it("should return undefined for unregistered feature", () => {
      const registry = createRegistry();
      const state = getFeatureState(registry, featureId("nonexistent"));
      assertEquals(state, undefined);
    });

    it("should return state for registered feature", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["my-feature"] },
      });

      const state = getFeatureState(registry, featureId("my-feature"));
      assertEquals(state?.enabled, true);
      assertEquals(state?.reason, "explicit-enabled");
    });
  });

  describe("setFeatureState", () => {
    it("should update feature state", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });

      assertEquals(isEnabled(registry, featureId("my-feature")), false);

      const updated = setFeatureState(registry, featureId("my-feature"), true);
      assertEquals(isEnabled(updated, featureId("my-feature")), true);
    });

    it("should return a new registry instance (immutable)", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });

      const updated = setFeatureState(registry, featureId("my-feature"), true);

      // Original should be unchanged
      assertEquals(isEnabled(registry, featureId("my-feature")), false);
      // New registry should have the change
      assertEquals(isEnabled(updated, featureId("my-feature")), true);
    });
  });

  describe("enableFeature / disableFeature", () => {
    it("should enable a feature", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });

      const updated = enableFeature(registry, featureId("my-feature"));
      assertEquals(isEnabled(updated, featureId("my-feature")), true);
    });

    it("should disable a feature", () => {
      const schema = buildSchema([{ id: "my-feature", defaultEnabled: true }]);
      const registry = createRegistry({ schema });

      const updated = disableFeature(registry, featureId("my-feature"));
      assertEquals(isEnabled(updated, featureId("my-feature")), false);
    });
  });

  describe("hierarchical features", () => {
    it("should expand parent feature to include children", () => {
      const schema = buildSchema([
        { id: "shimp" },
        { id: "shimp.fs" },
        { id: "shimp.env" },
      ]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["shimp"] },
      });

      // Parent and children should all be enabled
      assertEquals(isEnabled(registry, featureId("shimp")), true);
      assertEquals(isEnabled(registry, featureId("shimp.fs")), true);
      assertEquals(isEnabled(registry, featureId("shimp.env")), true);
    });

    it("should allow disabling child even when parent is enabled", () => {
      const schema = buildSchema([
        { id: "shimp" },
        { id: "shimp.fs" },
        { id: "shimp.env" },
      ]);
      const registry = createRegistry({
        schema,
        config: {
          enabled: ["shimp"],
          disabled: ["shimp.fs"],
        },
      });

      assertEquals(isEnabled(registry, featureId("shimp")), true);
      assertEquals(isEnabled(registry, featureId("shimp.fs")), false);
      assertEquals(isEnabled(registry, featureId("shimp.env")), true);
    });

    it("should disable children when parent is disabled", () => {
      const schema = buildSchema([
        { id: "shimp", defaultEnabled: true },
        { id: "shimp.fs", defaultEnabled: true },
        { id: "shimp.env", defaultEnabled: true },
      ]);
      const registry = createRegistry({
        schema,
        config: { disabled: ["shimp"] },
      });

      assertEquals(isEnabled(registry, featureId("shimp")), false);
      assertEquals(isEnabled(registry, featureId("shimp.fs")), false);
      assertEquals(isEnabled(registry, featureId("shimp.env")), false);
    });
  });

  describe("requireFeature", () => {
    it("should not throw for enabled feature", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["my-feature"] },
      });

      // Should not throw
      requireFeature(registry, featureId("my-feature"));
    });

    it("should throw for disabled feature", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });

      assertThrows(
        () => requireFeature(registry, featureId("my-feature")),
        Error
      );
    });
  });

  describe("listFeatures", () => {
    it("should list all registered features", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
        { id: "feature-c" },
      ]);
      const registry = createRegistry({ schema });

      const features = listFeatures(registry);
      assertEquals(features.length, 3);
    });
  });

  describe("listEnabledFeatures / listDisabledFeatures", () => {
    it("should list enabled features", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
      ]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["feature-a"] },
      });

      const enabled = listEnabledFeatures(registry);
      assertEquals(enabled.length, 1);
      assertEquals(enabled[0], featureId("feature-a"));
    });

    it("should list disabled features", () => {
      const schema = buildSchema([
        { id: "feature-a" },
        { id: "feature-b" },
      ]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["feature-a"] },
      });

      const disabled = listDisabledFeatures(registry);
      assertEquals(disabled.length, 1);
      assertEquals(disabled[0], featureId("feature-b"));
    });
  });

  describe("cloneRegistry", () => {
    it("should create an independent copy", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });
      const cloned = cloneRegistry(registry);

      // Modify cloned registry
      const updated = enableFeature(cloned, featureId("my-feature"));

      // Original should be unchanged
      assertEquals(isEnabled(registry, featureId("my-feature")), false);
      assertEquals(isEnabled(updated, featureId("my-feature")), true);
    });
  });

  describe("createSimpleRegistry", () => {
    it("should create a registry with enabled features", () => {
      const registry = createSimpleRegistry(["shimp.fs", "shimp.env"]);

      assertEquals(isEnabled(registry, featureId("shimp.fs")), true);
      assertEquals(isEnabled(registry, featureId("shimp.env")), true);
    });
  });

  describe("isDisabled", () => {
    it("should return true for disabled features", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({ schema });

      assertEquals(isDisabled(registry, featureId("my-feature")), true);
    });

    it("should return false for enabled features", () => {
      const schema = buildSchema([{ id: "my-feature" }]);
      const registry = createRegistry({
        schema,
        config: { enabled: ["my-feature"] },
      });

      assertEquals(isDisabled(registry, featureId("my-feature")), false);
    });
  });
});
