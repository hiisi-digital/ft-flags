/**
 * Tests for the Cargo-style feature manifest system
 *
 * @module
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  buildFeatureTree,
  createEmptyManifest,
  createSimpleManifest,
  detectCycles,
  type FeatureManifest,
  getEnableChain,
  isFeatureEnabled,
  listAvailableFeatures,
  listDisabledFeatures,
  listEnabledFeatures,
  parseManifest,
  type RawFtFlagsConfig,
  renderFeatureTree,
  resolveFeatures,
  toFeatureIdSet,
  toRawConfig,
  validateManifest,
} from "../src/manifest.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestManifest(): FeatureManifest {
  return parseManifest({
    features: {
      default: ["std"],
      std: ["fs", "env"],
      full: ["std", "experimental"],
      fs: [],
      env: [],
      args: [],
      experimental: ["async-runtime"],
      "async-runtime": [],
    },
    metadata: {
      std: {
        description: "Standard library features",
      },
      experimental: {
        description: "Experimental features",
        unstable: true,
      },
    },
  });
}

// =============================================================================
// parseManifest Tests
// =============================================================================

describe("parseManifest", () => {
  it("should parse a valid raw config", () => {
    const config: RawFtFlagsConfig = {
      features: {
        default: ["std"],
        std: [],
      },
    };

    const manifest = parseManifest(config);
    assertEquals(manifest.features.size, 2);
    assertEquals(manifest.features.get("default"), ["std"]);
    assertEquals(manifest.features.get("std"), []);
  });

  it("should parse metadata", () => {
    const config: RawFtFlagsConfig = {
      features: {
        myfeature: [],
      },
      metadata: {
        myfeature: {
          description: "Test feature",
          since: "1.0.0",
        },
      },
    };

    const manifest = parseManifest(config);
    const meta = manifest.metadata.get("myfeature");
    assertExists(meta);
    assertEquals(meta.description, "Test feature");
    assertEquals(meta.since, "1.0.0");
  });

  it("should handle metadata with all fields", () => {
    const config: RawFtFlagsConfig = {
      features: {
        legacy: [],
      },
      metadata: {
        legacy: {
          description: "Legacy feature",
          since: "0.1.0",
          unstable: false,
          deprecated: true,
          deprecatedMessage: "Use new-api instead",
          docsUrl: "https://example.com/docs",
          requiredDeps: ["some-package"],
        },
      },
    };

    const manifest = parseManifest(config);
    const meta = manifest.metadata.get("legacy");
    assertExists(meta);
    assertEquals(meta.deprecated, true);
    assertEquals(meta.deprecatedMessage, "Use new-api instead");
    assertEquals(meta.docsUrl, "https://example.com/docs");
  });

  it("should handle missing metadata gracefully", () => {
    const config: RawFtFlagsConfig = {
      features: {
        myfeature: [],
      },
      // No metadata section
    };

    const manifest = parseManifest(config);
    assertEquals(manifest.metadata.size, 0);
    assertEquals(manifest.metadata.get("myfeature"), undefined);
  });

  it("should preserve source information", () => {
    const config: RawFtFlagsConfig = {
      features: { test: [] },
    };

    const manifest = parseManifest(config, {
      type: "deno.json",
      path: "./deno.json",
    });

    assertExists(manifest.source);
    assertEquals(manifest.source.type, "deno.json");
    assertEquals(manifest.source.path, "./deno.json");
  });
});

// =============================================================================
// createEmptyManifest / createSimpleManifest Tests
// =============================================================================

describe("createEmptyManifest", () => {
  it("should create an empty manifest", () => {
    const manifest = createEmptyManifest();
    assertEquals(manifest.features.size, 0);
    assertEquals(manifest.metadata.size, 0);
  });
});

describe("createSimpleManifest", () => {
  it("should create a manifest with independent features", () => {
    const manifest = createSimpleManifest(["a", "b", "c"]);

    assertEquals(manifest.features.size, 3);
    assertEquals(manifest.features.get("a"), []);
    assertEquals(manifest.features.get("b"), []);
    assertEquals(manifest.features.get("c"), []);
  });

  it("should add default feature when specified", () => {
    const manifest = createSimpleManifest(["a", "b", "c"], ["a", "b"]);

    assertEquals(manifest.features.size, 4);
    assertEquals(manifest.features.get("default"), ["a", "b"]);
  });
});

// =============================================================================
// resolveFeatures Tests
// =============================================================================

describe("resolveFeatures", () => {
  it("should enable default features by default", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    assertEquals(resolved.enabled.has("default"), true);
    assertEquals(resolved.enabled.has("std"), true);
    assertEquals(resolved.enabled.has("fs"), true);
    assertEquals(resolved.enabled.has("env"), true);
  });

  it("should not enable non-default features by default", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    assertEquals(resolved.enabled.has("experimental"), false);
    assertEquals(resolved.enabled.has("async-runtime"), false);
    assertEquals(resolved.enabled.has("args"), false);
  });

  it("should respect noDefaultFeatures option", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, { noDefaultFeatures: true });

    assertEquals(resolved.enabled.size, 0);
  });

  it("should enable explicitly requested features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, {
      noDefaultFeatures: true,
      features: ["experimental"],
    });

    assertEquals(resolved.enabled.has("experimental"), true);
    assertEquals(resolved.enabled.has("async-runtime"), true);
    assertEquals(resolved.enabled.has("std"), false);
  });

  it("should enable all features with allFeatures option", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, { allFeatures: true });

    // All features should be enabled
    for (const name of manifest.features.keys()) {
      assertEquals(resolved.enabled.has(name), true);
    }
  });

  it("should transitively enable feature dependencies", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, {
      noDefaultFeatures: true,
      features: ["full"],
    });

    // full -> std, experimental
    // std -> fs, env
    // experimental -> async-runtime
    assertEquals(resolved.enabled.has("full"), true);
    assertEquals(resolved.enabled.has("std"), true);
    assertEquals(resolved.enabled.has("experimental"), true);
    assertEquals(resolved.enabled.has("fs"), true);
    assertEquals(resolved.enabled.has("env"), true);
    assertEquals(resolved.enabled.has("async-runtime"), true);
  });

  it("should track enabledBy chains", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, {
      noDefaultFeatures: true,
      features: ["full"],
    });

    // fs should be enabled by std, which was enabled by full
    const fsEnablers = resolved.enabledBy.get("fs");
    assertExists(fsEnablers);
    assertEquals(fsEnablers.includes("std"), true);
  });

  it("should handle features with no dependencies", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, {
      noDefaultFeatures: true,
      features: ["args"],
    });

    assertEquals(resolved.enabled.size, 1);
    assertEquals(resolved.enabled.has("args"), true);
  });
});

// =============================================================================
// isFeatureEnabled Tests
// =============================================================================

describe("isFeatureEnabled", () => {
  it("should return true for enabled features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    assertEquals(isFeatureEnabled("std", resolved), true);
  });

  it("should return false for disabled features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    assertEquals(isFeatureEnabled("experimental", resolved), false);
  });

  it("should return false for unknown features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    assertEquals(isFeatureEnabled("unknown-feature", resolved), false);
  });
});

// =============================================================================
// getEnableChain Tests
// =============================================================================

describe("getEnableChain", () => {
  it("should return null for disabled features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, { noDefaultFeatures: true });

    const chain = getEnableChain("std", resolved);
    assertEquals(chain, null);
  });

  it("should return chain for enabled features", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);

    const chain = getEnableChain("fs", resolved);
    assertExists(chain);
    assertEquals(chain.length > 0, true);
    assertEquals(chain[chain.length - 1], "fs");
  });

  it("should show transitive enable path", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest, {
      noDefaultFeatures: true,
      features: ["full"],
    });

    const chain = getEnableChain("fs", resolved);
    assertExists(chain);
    // The chain should show how fs was enabled
    assertEquals(chain.includes("std"), true);
    assertEquals(chain.includes("fs"), true);
  });
});

// =============================================================================
// listAvailableFeatures / listEnabledFeatures / listDisabledFeatures Tests
// =============================================================================

describe("listAvailableFeatures", () => {
  it("should return all feature names sorted", () => {
    const manifest = createTestManifest();
    const available = listAvailableFeatures(manifest);

    assertEquals(available.length, 8);
    // Check it's sorted
    assertEquals(available, [...available].sort());
  });
});

describe("listEnabledFeatures", () => {
  it("should return only enabled features sorted", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);
    const enabled = listEnabledFeatures(resolved);

    assertEquals(enabled.includes("default"), true);
    assertEquals(enabled.includes("std"), true);
    assertEquals(enabled.includes("experimental"), false);
    assertEquals(enabled, [...enabled].sort());
  });
});

describe("listDisabledFeatures", () => {
  it("should return only disabled features sorted", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);
    const disabled = listDisabledFeatures(resolved);

    assertEquals(disabled.includes("experimental"), true);
    assertEquals(disabled.includes("async-runtime"), true);
    assertEquals(disabled.includes("std"), false);
    assertEquals(disabled, [...disabled].sort());
  });
});

// =============================================================================
// validateManifest Tests
// =============================================================================

describe("validateManifest", () => {
  it("should validate a correct manifest", () => {
    const manifest = createTestManifest();
    const result = validateManifest(manifest);

    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  it("should detect unknown feature references", () => {
    const manifest = parseManifest({
      features: {
        default: ["std"],
        std: ["unknown-feature"],
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.valid, false);
    assertEquals(result.errors.some((e) => e.includes("unknown-feature")), true);
  });

  it("should detect self-references", () => {
    const manifest = parseManifest({
      features: {
        default: ["default"],
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.valid, false);
    assertEquals(result.errors.some((e) => e.includes("references itself")), true);
  });

  it("should warn about deprecated features without message", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        legacy: [],
      },
      metadata: {
        legacy: {
          deprecated: true,
        },
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.warnings.some((w) => w.includes("deprecation message")), true);
  });

  it("should warn when no default feature is defined", () => {
    const manifest = parseManifest({
      features: {
        std: [],
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.warnings.some((w) => w.includes("default")), true);
  });

  it("should warn about metadata for unknown features", () => {
    const manifest = parseManifest({
      features: {
        default: [],
      },
      metadata: {
        unknown: {
          description: "This feature doesn't exist",
        },
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.warnings.some((w) => w.includes("unknown")), true);
  });
});

// =============================================================================
// detectCycles Tests
// =============================================================================

describe("detectCycles", () => {
  it("should return empty for acyclic manifests", () => {
    const manifest = createTestManifest();
    const cycles = detectCycles(manifest);

    assertEquals(cycles.length, 0);
  });

  it("should detect direct cycles", () => {
    const manifest = parseManifest({
      features: {
        a: ["b"],
        b: ["a"],
      },
    });

    const cycles = detectCycles(manifest);
    assertEquals(cycles.length > 0, true);
  });

  it("should detect indirect cycles", () => {
    const manifest = parseManifest({
      features: {
        a: ["b"],
        b: ["c"],
        c: ["a"],
      },
    });

    const cycles = detectCycles(manifest);
    assertEquals(cycles.length > 0, true);
  });
});

// =============================================================================
// Feature Tree Tests
// =============================================================================

describe("buildFeatureTree", () => {
  it("should build a tree for all features", () => {
    const manifest = createTestManifest();
    const tree = buildFeatureTree(manifest);

    assertEquals(tree.length > 0, true);
  });

  it("should build a tree for a specific root", () => {
    const manifest = createTestManifest();
    const tree = buildFeatureTree(manifest, "full");

    assertEquals(tree.length, 1);
    assertEquals(tree[0].name, "full");
    assertEquals(tree[0].children.length, 2); // std, experimental
  });

  it("should support dependency feature references", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        serialization: ["serde/derive"],
        async: ["tokio/full", "dep:async-hooks"],
      },
    });

    const result = validateManifest(manifest);
    // Should not error on dep refs or dep: prefixes
    assertEquals(result.errors.filter((e) => e.includes("serde/derive")).length, 0);
    assertEquals(result.errors.filter((e) => e.includes("tokio/full")).length, 0);
    assertEquals(result.errors.filter((e) => e.includes("dep:async-hooks")).length, 0);
  });

  it("should return empty for unknown root", () => {
    const manifest = createTestManifest();
    const tree = buildFeatureTree(manifest, "unknown");

    assertEquals(tree.length, 0);
  });

  it("should mark circular references", () => {
    const manifest = parseManifest({
      features: {
        a: ["b"],
        b: ["a"],
      },
    });

    const tree = buildFeatureTree(manifest, "a");
    const bNode = tree[0].children[0];
    const aChildOfB = bNode.children[0];

    assertEquals(aChildOfB.isCircular, true);
  });
});

describe("renderFeatureTree", () => {
  it("should render a simple tree", () => {
    const nodes = [
      {
        name: "parent",
        children: [
          { name: "child1", children: [] },
          { name: "child2", children: [] },
        ],
      },
    ];

    const output = renderFeatureTree(nodes);
    assertEquals(output.includes("parent"), true);
    assertEquals(output.includes("child1"), true);
    assertEquals(output.includes("child2"), true);
  });
});

// =============================================================================
// Conversion Utilities Tests
// =============================================================================

describe("toFeatureIdSet", () => {
  it("should convert resolved features to FeatureId set", () => {
    const manifest = createTestManifest();
    const resolved = resolveFeatures(manifest);
    const ids = toFeatureIdSet(resolved);

    // Valid feature IDs should be converted
    assertEquals(ids.size > 0, true);
  });
});

describe("toRawConfig", () => {
  it("should convert manifest back to raw config", () => {
    const manifest = createTestManifest();
    const raw = toRawConfig(manifest);

    assertEquals(typeof raw.features, "object");
    assertEquals(Array.isArray(raw.features.default), true);
    assertEquals(raw.features.default.includes("std"), true);
  });

  it("should round-trip correctly", () => {
    const original = createTestManifest();
    const raw = toRawConfig(original);
    const parsed = parseManifest(raw);

    assertEquals(parsed.features.size, original.features.size);
    assertEquals(parsed.features.get("default"), original.features.get("default"));
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("edge cases", () => {
  it("should handle empty features map", () => {
    const manifest = parseManifest({ features: {} });
    const resolved = resolveFeatures(manifest);

    assertEquals(resolved.enabled.size, 0);
  });

  it("should handle manifest with only default", () => {
    const manifest = parseManifest({
      features: {
        default: [],
      },
    });

    const resolved = resolveFeatures(manifest);
    assertEquals(resolved.enabled.has("default"), true);
    assertEquals(resolved.enabled.size, 1);
  });

  it("should ignore dep: references in validation", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        async: ["dep:async-hooks"],
      },
    });

    const result = validateManifest(manifest);
    // Should not error on dep: references
    assertEquals(
      result.errors.some((e) => e.includes("dep:async-hooks")),
      false,
    );
  });

  it("should handle deeply nested features", () => {
    const manifest = parseManifest({
      features: {
        default: ["a"],
        a: ["b"],
        b: ["c"],
        c: ["d"],
        d: ["e"],
        e: [],
      },
    });

    const resolved = resolveFeatures(manifest);
    assertEquals(resolved.enabled.has("e"), true);
  });

  it("should handle diamond dependencies", () => {
    // a -> b, c
    // b -> d
    // c -> d
    // d should only be enabled once
    const manifest = parseManifest({
      features: {
        default: ["a"],
        a: ["b", "c"],
        b: ["d"],
        c: ["d"],
        d: [],
      },
    });

    const resolved = resolveFeatures(manifest);
    assertEquals(resolved.enabled.has("d"), true);

    // Count enabled features
    const enabledList = listEnabledFeatures(resolved);
    const uniqueEnabled = new Set(enabledList);
    assertEquals(enabledList.length, uniqueEnabled.size);
  });
});
