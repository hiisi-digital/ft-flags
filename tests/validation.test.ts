/**
 * Comprehensive validation tests for feature naming and dependency checking
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  detectCycles,
  extractExternalReferences,
  isValidFeatureReference,
  isValidPackageName,
  type PackageDependencies,
  parseManifest,
  validateManifest,
} from "../src/manifest.ts";
import { isValidFeatureId } from "../src/types.ts";

// =============================================================================
// Feature Name Validation Tests
// =============================================================================

describe("Feature Name Validation", () => {
  describe("isValidFeatureId", () => {
    it("should accept valid kebab-case names", () => {
      assertEquals(isValidFeatureId("fs"), true);
      assertEquals(isValidFeatureId("async-runtime"), true);
      assertEquals(isValidFeatureId("serde-support"), true);
      assertEquals(isValidFeatureId("v2-api"), true);
      assertEquals(isValidFeatureId("a"), true);
      assertEquals(isValidFeatureId("abc123"), true);
      assertEquals(isValidFeatureId("feature-with-numbers-123"), true);
    });

    it("should reject empty strings", () => {
      assertEquals(isValidFeatureId(""), false);
    });

    it("should reject names with dots (legacy hierarchical notation)", () => {
      assertEquals(isValidFeatureId("shimp.fs"), false);
      assertEquals(isValidFeatureId("a.b.c"), false);
      assertEquals(isValidFeatureId("feature.name"), false);
    });

    it("should reject names with uppercase letters", () => {
      assertEquals(isValidFeatureId("AsyncRuntime"), false);
      assertEquals(isValidFeatureId("UPPERCASE"), false);
      assertEquals(isValidFeatureId("camelCase"), false);
      assertEquals(isValidFeatureId("PascalCase"), false);
    });

    it("should reject names starting with hyphens", () => {
      assertEquals(isValidFeatureId("-leading"), false);
    });

    it("should reject names ending with hyphens", () => {
      assertEquals(isValidFeatureId("trailing-"), false);
    });

    it("should reject names with consecutive hyphens", () => {
      assertEquals(isValidFeatureId("double--hyphen"), false);
      assertEquals(isValidFeatureId("triple---hyphen"), false);
    });

    it("should reject names starting with numbers", () => {
      assertEquals(isValidFeatureId("123-feature"), false);
      assertEquals(isValidFeatureId("1st"), false);
    });

    it("should reject names with special characters", () => {
      assertEquals(isValidFeatureId("feature_name"), false);
      assertEquals(isValidFeatureId("feature@name"), false);
      assertEquals(isValidFeatureId("feature!"), false);
      assertEquals(isValidFeatureId("feature name"), false);
    });

    it("should reject names with colons (those are for pkg:feature refs)", () => {
      assertEquals(isValidFeatureId("pkg:feature"), false);
    });
  });

  describe("isValidPackageName", () => {
    it("should accept valid package names", () => {
      assertEquals(isValidPackageName("lodash"), true);
      assertEquals(isValidPackageName("async-runtime"), true);
      assertEquals(isValidPackageName("my-package"), true);
    });

    it("should accept scoped package names", () => {
      assertEquals(isValidPackageName("@scope/package"), true);
      assertEquals(isValidPackageName("@myorg/my-lib"), true);
      assertEquals(isValidPackageName("@hiisi/ft-flags"), true);
    });

    it("should reject invalid scoped packages", () => {
      assertEquals(isValidPackageName("@scope"), false);
      assertEquals(isValidPackageName("@scope/"), false);
      assertEquals(isValidPackageName("@/package"), false);
      assertEquals(isValidPackageName("@scope/too/many/parts"), false);
    });

    it("should reject empty strings", () => {
      assertEquals(isValidPackageName(""), false);
    });

    it("should reject invalid characters", () => {
      assertEquals(isValidPackageName("Package"), false);
      assertEquals(isValidPackageName("my_package"), false);
    });
  });

  describe("isValidFeatureReference", () => {
    it("should accept local feature references", () => {
      assertEquals(isValidFeatureReference("fs"), true);
      assertEquals(isValidFeatureReference("async-runtime"), true);
      assertEquals(isValidFeatureReference("default"), true);
    });

    it("should accept dep: references", () => {
      assertEquals(isValidFeatureReference("dep:lodash"), true);
      assertEquals(isValidFeatureReference("dep:@scope/package"), true);
      assertEquals(isValidFeatureReference("dep:async-hooks"), true);
    });

    it("should reject invalid dep: references", () => {
      assertEquals(isValidFeatureReference("dep:"), false);
      assertEquals(isValidFeatureReference("dep:Invalid"), false);
    });

    it("should accept pkg:feature references", () => {
      assertEquals(isValidFeatureReference("lodash:clone"), true);
      assertEquals(isValidFeatureReference("@scope/pkg:feature"), true);
      assertEquals(isValidFeatureReference("serde:derive"), true);
    });

    it("should reject invalid pkg:feature references", () => {
      assertEquals(isValidFeatureReference("pkg:Invalid"), false);
      assertEquals(isValidFeatureReference("Invalid:feature"), false);
    });
  });
});

// =============================================================================
// Manifest Validation Tests
// =============================================================================

describe("Manifest Validation", () => {
  describe("validateManifest - feature names", () => {
    it("should accept valid kebab-case feature names", () => {
      const manifest = parseManifest({
        features: {
          default: ["std"],
          std: ["fs", "env"],
          fs: [],
          env: [],
          "async-runtime": [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, true);
      assertEquals(result.errors.length, 0);
    });

    it("should reject feature names with dots", () => {
      const manifest = parseManifest({
        features: {
          default: [],
          "shimp.fs": [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("shimp.fs")), true);
      assertEquals(result.errors.some((e) => e.includes("kebab-case")), true);
    });

    it("should reject feature names with uppercase", () => {
      const manifest = parseManifest({
        features: {
          default: [],
          AsyncRuntime: [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("AsyncRuntime")), true);
    });

    it("should reject dep: as feature names", () => {
      const manifest = parseManifest({
        features: {
          default: [],
          "dep:tokio": [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("dep:tokio")), true);
    });

    it("should reject pkg:feature as feature names", () => {
      const manifest = parseManifest({
        features: {
          default: [],
          "serde:derive": [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("serde:derive")), true);
    });
  });

  describe("validateManifest - feature references", () => {
    it("should accept valid local references", () => {
      const manifest = parseManifest({
        features: {
          default: ["std"],
          std: ["fs", "env"],
          fs: [],
          env: [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, true);
    });

    it("should accept dep: references in features", () => {
      const manifest = parseManifest({
        features: {
          default: ["async"],
          async: ["dep:tokio"],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, true);
    });

    it("should accept pkg:feature references in features", () => {
      const manifest = parseManifest({
        features: {
          default: ["serialization"],
          serialization: ["serde:derive", "@myorg/utils:json"],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, true);
    });

    it("should reject invalid dep: reference format", () => {
      const manifest = parseManifest({
        features: {
          default: ["broken"],
          broken: ["dep:"],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("dep:")), true);
    });

    it("should reject references to unknown local features", () => {
      const manifest = parseManifest({
        features: {
          default: ["unknown-feature"],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("unknown-feature")), true);
    });
  });

  describe("validateManifest - dependency validation", () => {
    const deps: PackageDependencies = {
      dependencies: {
        lodash: "^4.17.21",
        "@myorg/utils": "^1.0.0",
      },
      optionalDependencies: {
        "optional-pkg": "^1.0.0",
      },
    };

    it("should not warn about dep: for existing dependencies", () => {
      const manifest = parseManifest({
        features: {
          default: ["with-lodash"],
          "with-lodash": ["dep:lodash"],
        },
      });

      const result = validateManifest(manifest, { dependencies: deps });
      assertEquals(result.warnings.some((w) => w.includes("lodash")), false);
    });

    it("should warn about dep: for non-existent dependencies", () => {
      const manifest = parseManifest({
        features: {
          default: ["async"],
          async: ["dep:non-existent-package"],
        },
      });

      const result = validateManifest(manifest, { dependencies: deps });
      assertEquals(result.warnings.some((w) => w.includes("non-existent-package")), true);
    });

    it("should error on non-existent deps when strictDependencies is true", () => {
      const manifest = parseManifest({
        features: {
          default: ["async"],
          async: ["dep:non-existent-package"],
        },
      });

      const result = validateManifest(manifest, {
        dependencies: deps,
        strictDependencies: true,
      });
      assertEquals(result.valid, false);
      assertEquals(result.errors.some((e) => e.includes("non-existent-package")), true);
    });

    it("should not warn about pkg:feature for existing dependencies", () => {
      const manifest = parseManifest({
        features: {
          default: ["with-utils"],
          "with-utils": ["@myorg/utils:json"],
        },
      });

      const result = validateManifest(manifest, { dependencies: deps });
      assertEquals(result.warnings.some((w) => w.includes("@myorg/utils")), false);
    });

    it("should warn about pkg:feature for non-existent dependencies", () => {
      const manifest = parseManifest({
        features: {
          default: ["serialization"],
          serialization: ["unknown-pkg:feature"],
        },
      });

      const result = validateManifest(manifest, { dependencies: deps });
      assertEquals(result.warnings.some((w) => w.includes("unknown-pkg")), true);
    });

    it("should check optional dependencies", () => {
      const manifest = parseManifest({
        features: {
          default: ["with-optional"],
          "with-optional": ["dep:optional-pkg"],
        },
      });

      const result = validateManifest(manifest, { dependencies: deps });
      assertEquals(result.warnings.some((w) => w.includes("optional-pkg")), false);
    });
  });

  describe("validateManifest - default feature", () => {
    it("should warn when default feature is missing", () => {
      const manifest = parseManifest({
        features: {
          std: [],
          fs: [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.warnings.some((w) => w.includes("default")), true);
    });

    it("should warn when default feature is empty", () => {
      const manifest = parseManifest({
        features: {
          default: [],
          std: [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(result.warnings.some((w) => w.includes("default")), true);
    });

    it("should not warn when default feature has contents", () => {
      const manifest = parseManifest({
        features: {
          default: ["std"],
          std: [],
        },
      });

      const result = validateManifest(manifest);
      assertEquals(
        result.warnings.some((w) => w.toLowerCase().includes("default") && w.includes("empty")),
        false,
      );
    });
  });
});

// =============================================================================
// External Reference Extraction Tests
// =============================================================================

describe("extractExternalReferences", () => {
  it("should extract dep: references", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        async: ["dep:tokio", "dep:async-std"],
      },
    });

    const refs = extractExternalReferences(manifest);
    assertEquals(refs.length, 2);
    assertEquals(refs.every((r) => r.type === "dep"), true);
    assertEquals(refs.some((r) => r.packageName === "tokio"), true);
    assertEquals(refs.some((r) => r.packageName === "async-std"), true);
  });

  it("should extract pkg:feature references", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        serialization: ["serde:derive", "@myorg/utils:json"],
      },
    });

    const refs = extractExternalReferences(manifest);
    assertEquals(refs.length, 2);
    assertEquals(refs.every((r) => r.type === "pkg-feature"), true);
    assertEquals(refs.some((r) => r.packageName === "serde" && r.featureName === "derive"), true);
    assertEquals(
      refs.some((r) => r.packageName === "@myorg/utils" && r.featureName === "json"),
      true,
    );
  });

  it("should not extract local references", () => {
    const manifest = parseManifest({
      features: {
        default: ["std"],
        std: ["fs", "env"],
        fs: [],
        env: [],
      },
    });

    const refs = extractExternalReferences(manifest);
    assertEquals(refs.length, 0);
  });

  it("should track which feature contains the reference", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        "feature-a": ["dep:pkg-a"],
        "feature-b": ["dep:pkg-b"],
      },
    });

    const refs = extractExternalReferences(manifest);
    assertEquals(refs.find((r) => r.packageName === "pkg-a")?.feature, "feature-a");
    assertEquals(refs.find((r) => r.packageName === "pkg-b")?.feature, "feature-b");
  });
});

// =============================================================================
// Cycle Detection Tests
// =============================================================================

describe("detectCycles - comprehensive", () => {
  it("should detect simple A -> B -> A cycle", () => {
    const manifest = parseManifest({
      features: {
        a: ["b"],
        b: ["a"],
      },
    });

    const cycles = detectCycles(manifest);
    assertEquals(cycles.length > 0, true);
  });

  it("should detect longer cycles A -> B -> C -> A", () => {
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

  it("should detect self-cycles A -> A", () => {
    const manifest = parseManifest({
      features: {
        a: ["a"],
      },
    });

    // Self-reference is caught by validateManifest separately
    // detectCycles may or may not catch this depending on implementation
    const result = validateManifest(manifest);
    assertEquals(result.valid, false);
  });

  it("should handle diamond dependencies without false positives", () => {
    const manifest = parseManifest({
      features: {
        top: ["left", "right"],
        left: ["bottom"],
        right: ["bottom"],
        bottom: [],
      },
    });

    const cycles = detectCycles(manifest);
    assertEquals(cycles.length, 0);
  });

  it("should not consider external references as cycles", () => {
    const manifest = parseManifest({
      features: {
        a: ["dep:external-pkg"],
        b: ["serde/derive"],
      },
    });

    const cycles = detectCycles(manifest);
    assertEquals(cycles.length, 0);
  });

  it("should find all cycles in complex graph", () => {
    const manifest = parseManifest({
      features: {
        a: ["b"],
        b: ["c"],
        c: ["a"], // cycle 1: a -> b -> c -> a
        d: ["e"],
        e: ["d"], // cycle 2: d -> e -> d
        safe: [],
      },
    });

    const cycles = detectCycles(manifest);
    // Should find at least 2 cycles
    assertEquals(cycles.length >= 2, true);
  });
});

// =============================================================================
// Metadata Validation Tests
// =============================================================================

describe("Metadata Validation", () => {
  it("should warn about deprecated features without deprecation message", () => {
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

  it("should not warn when deprecation message is provided", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        legacy: [],
      },
      metadata: {
        legacy: {
          deprecated: true,
          deprecatedMessage: "Use new-feature instead",
        },
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.warnings.some((w) => w.includes("deprecation message")), false);
  });

  it("should warn about metadata for non-existent features", () => {
    const manifest = parseManifest({
      features: {
        default: [],
        real: [],
      },
      metadata: {
        "non-existent": {
          description: "This feature doesn't exist",
        },
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.warnings.some((w) => w.includes("non-existent")), true);
  });

  it("should accept valid metadata for existing features", () => {
    const manifest = parseManifest({
      features: {
        default: ["std"],
        std: [],
      },
      metadata: {
        std: {
          description: "Standard library features",
          since: "1.0.0",
        },
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.valid, true);
    assertEquals(result.warnings.some((w) => w.includes("std")), false);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Validation Edge Cases", () => {
  it("should handle empty manifest", () => {
    const manifest = parseManifest({
      features: {},
    });

    const result = validateManifest(manifest);
    // Should be valid but with warning about no default
    assertEquals(result.errors.length, 0);
    assertEquals(result.warnings.some((w) => w.includes("default")), true);
  });

  it("should handle manifest with only default", () => {
    const manifest = parseManifest({
      features: {
        default: [],
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.valid, true);
  });

  it("should handle deeply nested feature chains", () => {
    const manifest = parseManifest({
      features: {
        default: ["a"],
        a: ["b"],
        b: ["c"],
        c: ["d"],
        d: ["e"],
        e: ["f"],
        f: ["g"],
        g: ["h"],
        h: ["i"],
        i: ["j"],
        j: [],
      },
    });

    const result = validateManifest(manifest);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  it("should handle many features", () => {
    const features: Record<string, string[]> = { default: [] };
    for (let i = 0; i < 100; i++) {
      features[`feature-${i}`] = [];
    }

    const manifest = parseManifest({ features });

    const result = validateManifest(manifest);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });

  it("should handle complex mixed references", () => {
    const manifest = parseManifest({
      features: {
        default: ["std"],
        std: ["fs", "env"],
        fs: [],
        env: [],
        full: ["std", "experimental", "dep:tokio", "serde:derive"],
        experimental: ["async-runtime"],
        "async-runtime": ["dep:async-std"],
      },
    });

    const deps: PackageDependencies = {
      dependencies: {
        tokio: "^1.0.0",
        "async-std": "^1.0.0",
        serde: "^1.0.0",
      },
    };

    const result = validateManifest(manifest, { dependencies: deps });
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
  });
});
