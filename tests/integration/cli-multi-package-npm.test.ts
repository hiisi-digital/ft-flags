/**
 * Multi-package CLI integration tests with package.json
 *
 * This test creates temporary "packages" with package.json files,
 * each with different features and complex dependency graphs,
 * then verifies the CLI tool works correctly on each.
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";

// =============================================================================
// Test Setup
// =============================================================================

interface TestPackage {
  name: string;
  config: Record<string, unknown>;
}

let tempDir: string;

const testPackages: TestPackage[] = [
  // Package A: Standard npm package with features
  {
    name: "npm-pkg-a",
    config: {
      name: "@test/npm-pkg-a",
      version: "1.0.0",
      description: "Test package A",
      main: "index.js",
      features: {
        default: ["core", "utils"],
        core: [],
        utils: [],
        "dev-tools": ["core"],
        cli: ["utils"],
      },
      metadata: {
        features: {
          core: { description: "Core library functionality" },
          utils: { description: "Utility functions" },
          "dev-tools": { description: "Development tools", unstable: true },
          cli: { description: "Command-line interface" },
        },
      },
      dependencies: {
        lodash: "^4.17.21",
      },
    },
  },
  // Package B: Scoped package with complex features
  {
    name: "npm-pkg-b",
    config: {
      name: "@myorg/service",
      version: "2.5.0",
      private: true,
      features: {
        default: ["http"],
        http: ["async-io"],
        "async-io": [],
        grpc: ["async-io", "protobuf"],
        protobuf: [],
        "full-stack": ["http", "grpc", "database"],
        database: ["async-io"],
        metrics: [],
        tracing: ["metrics"],
      },
    },
  },
  // Package C: React-style package with feature flags
  {
    name: "npm-pkg-c",
    config: {
      name: "my-ui-library",
      version: "0.8.0",
      peerDependencies: {
        react: "^18.0.0",
      },
      features: {
        default: ["components"],
        components: ["theming"],
        theming: [],
        animations: ["theming"],
        "advanced-forms": ["components", "validation"],
        validation: [],
        "ssr-support": ["components"],
        "all-features": ["components", "animations", "advanced-forms", "ssr-support"],
      },
      metadata: {
        features: {
          animations: {
            description: "Animation support using framer-motion",
            requiredDeps: ["framer-motion"],
          },
          "ssr-support": {
            description: "Server-side rendering support",
            since: "0.7.0",
          },
        },
      },
    },
  },
  // Package D: Monorepo internal package
  {
    name: "npm-pkg-d",
    config: {
      name: "@internal/shared",
      version: "0.0.1",
      private: true,
      features: {
        "type-utils": [],
        "test-helpers": ["type-utils"],
        mocks: ["test-helpers"],
        stubs: ["test-helpers"],
        "full-test-kit": ["mocks", "stubs"],
      },
    },
  },
  // Package E: Package with optional dependencies via dep:
  {
    name: "npm-pkg-e",
    config: {
      name: "flexible-logger",
      version: "3.0.0",
      features: {
        default: ["console"],
        console: [],
        file: ["dep:fs-extra"],
        http: ["dep:node-fetch"],
        "cloud-logging": ["dep:@google-cloud/logging"],
        structured: ["console"],
        "full-logging": ["console", "file", "http", "structured"],
      },
      optionalDependencies: {
        "fs-extra": "^11.0.0",
        "node-fetch": "^3.0.0",
        "@google-cloud/logging": "^10.0.0",
      },
    },
  },
  // Package F: Deep transitive dependencies
  {
    name: "npm-pkg-f",
    config: {
      name: "deep-chain",
      version: "1.0.0",
      features: {
        default: ["a"],
        a: ["b"],
        b: ["c"],
        c: ["d"],
        d: ["e"],
        e: ["f"],
        f: [],
        "skip-chain": ["f"],
      },
    },
  },
  // Package G: Circular reference detection
  {
    name: "npm-pkg-g",
    config: {
      name: "circular-test",
      version: "1.0.0",
      features: {
        default: [],
        "cycle-a": ["cycle-b"],
        "cycle-b": ["cycle-a"],
        safe: [],
      },
    },
  },
];

async function createTestPackages(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "ft-flags-npm-test-" });

  await Promise.all(
    testPackages.map(async (pkg) => {
      const pkgDir = `${dir}/${pkg.name}`;
      await Deno.mkdir(pkgDir, { recursive: true });
      await Deno.writeTextFile(
        `${pkgDir}/package.json`,
        JSON.stringify(pkg.config, null, 2),
      );
    }),
  );

  return dir;
}

async function runCli(
  packagePath: string,
  args: string[],
): Promise<{ code: number; output: string }> {
  const cliPath = new URL("../../src/cli.ts", import.meta.url).pathname;

  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", "--allow-env", cliPath, "--package", packagePath, ...args],
    stdout: "piped",
    stderr: "piped",
    env: { NO_COLOR: "1" }, // Disable colors for easier testing
  });

  const process = await command.output();
  const stdout = new TextDecoder().decode(process.stdout);
  const stderr = new TextDecoder().decode(process.stderr);

  return {
    code: process.code,
    output: stdout + stderr,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("CLI Multi-Package Integration (package.json)", () => {
  beforeAll(async () => {
    tempDir = await createTestPackages();
  });

  afterAll(async () => {
    if (tempDir) {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  describe("npm-pkg-a: Standard npm package", () => {
    it("should list all features", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "core");
      assertStringIncludes(result.output, "utils");
      assertStringIncludes(result.output, "dev-tools");
      assertStringIncludes(result.output, "cli");
    });

    it("should resolve default features", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "default");
      assertStringIncludes(result.output, "core");
      assertStringIncludes(result.output, "utils");
    });

    it("should check dev-tools not enabled by default", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["check", "dev-tools"]);
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "not enabled");
    });

    it("should validate successfully", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "valid");
    });

    it("should show feature metadata in list", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "unstable");
    });
  });

  describe("npm-pkg-b: Complex service features", () => {
    it("should resolve full-stack with all dependencies", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-b`, [
        "resolve",
        "--features",
        "full-stack",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "full-stack");
      assertStringIncludes(result.output, "http");
      assertStringIncludes(result.output, "grpc");
      assertStringIncludes(result.output, "database");
      assertStringIncludes(result.output, "async-io");
      assertStringIncludes(result.output, "protobuf");
    });

    it("should show tree for grpc", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-b`, ["tree", "grpc"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "grpc");
      assertStringIncludes(result.output, "async-io");
      assertStringIncludes(result.output, "protobuf");
    });

    it("should resolve tracing chain", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-b`, [
        "resolve",
        "--features",
        "tracing",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "tracing");
      assertStringIncludes(result.output, "metrics");
    });
  });

  describe("npm-pkg-c: UI library features", () => {
    it("should resolve all-features completely", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-c`, [
        "resolve",
        "--features",
        "all-features",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "all-features");
      assertStringIncludes(result.output, "components");
      assertStringIncludes(result.output, "animations");
      assertStringIncludes(result.output, "advanced-forms");
      assertStringIncludes(result.output, "ssr-support");
      assertStringIncludes(result.output, "theming");
      assertStringIncludes(result.output, "validation");
    });

    it("should resolve default with theming", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-c`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "components");
      assertStringIncludes(result.output, "theming");
    });

    it("should show tree for advanced-forms", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-c`, ["tree", "advanced-forms"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "advanced-forms");
      assertStringIncludes(result.output, "components");
      assertStringIncludes(result.output, "validation");
    });
  });

  describe("npm-pkg-d: Internal package with no default", () => {
    it("should warn about no default feature", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-d`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output.toLowerCase(), "default");
    });

    it("should resolve nothing by default", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-d`, ["resolve"]);
      assertEquals(result.code, 0);
      // Empty default - should show (none) or similar
    });

    it("should resolve full-test-kit with all test helpers", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-d`, [
        "resolve",
        "--features",
        "full-test-kit",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "full-test-kit");
      assertStringIncludes(result.output, "mocks");
      assertStringIncludes(result.output, "stubs");
      assertStringIncludes(result.output, "test-helpers");
      assertStringIncludes(result.output, "type-utils");
    });
  });

  describe("npm-pkg-e: Optional dependencies via dep:", () => {
    it("should validate with dep: references", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-e`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "valid");
    });

    it("should list features with dep references", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-e`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "file");
      assertStringIncludes(result.output, "http");
      assertStringIncludes(result.output, "cloud-logging");
    });

    it("should resolve full-logging", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-e`, [
        "resolve",
        "--features",
        "full-logging",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "full-logging");
      assertStringIncludes(result.output, "console");
      assertStringIncludes(result.output, "file");
      assertStringIncludes(result.output, "http");
      assertStringIncludes(result.output, "structured");
    });
  });

  describe("npm-pkg-f: Deep transitive chain", () => {
    it("should resolve entire chain from default", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-f`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "a");
      assertStringIncludes(result.output, "b");
      assertStringIncludes(result.output, "c");
      assertStringIncludes(result.output, "d");
      assertStringIncludes(result.output, "e");
      assertStringIncludes(result.output, "f");
    });

    it("should resolve skip-chain directly to f", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-f`, [
        "resolve",
        "--features",
        "skip-chain",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "skip-chain");
      assertStringIncludes(result.output, "f");
    });

    it("should show deep tree", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-f`, ["tree", "a"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "a");
      assertStringIncludes(result.output, "f");
    });
  });

  describe("npm-pkg-g: Circular reference detection", () => {
    it("should detect circular dependency", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-g`, ["validate"]);
      // Should report the cycle as an error
      assertStringIncludes(result.output.toLowerCase(), "circular");
    });

    it("should still list features", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-g`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "cycle-a");
      assertStringIncludes(result.output, "cycle-b");
      assertStringIncludes(result.output, "safe");
    });

    it("should resolve safe feature without issues", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-g`, ["resolve", "--features", "safe"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "safe");
    });
  });

  describe("Cross-package operations", () => {
    it("should handle all packages in parallel", async () => {
      const packages = [
        "npm-pkg-a",
        "npm-pkg-b",
        "npm-pkg-c",
        "npm-pkg-d",
        "npm-pkg-e",
        "npm-pkg-f",
        "npm-pkg-g",
      ];

      const results = await Promise.all(
        packages.map((pkg) => runCli(`${tempDir}/${pkg}`, ["list"])),
      );

      for (let i = 0; i < results.length; i++) {
        assertEquals(results[i].code, 0, `Failed for ${packages[i]}`);
      }
    });

    it("should resolve all packages consistently", async () => {
      const packages = ["npm-pkg-a", "npm-pkg-b", "npm-pkg-c", "npm-pkg-f"];

      const results = await Promise.all(
        packages.map((pkg) => runCli(`${tempDir}/${pkg}`, ["resolve"])),
      );

      for (let i = 0; i < results.length; i++) {
        assertEquals(results[i].code, 0, `Failed for ${packages[i]}`);
      }
    });

    it("should validate all packages", async () => {
      const packages = [
        "npm-pkg-a",
        "npm-pkg-b",
        "npm-pkg-c",
        "npm-pkg-d",
        "npm-pkg-e",
        "npm-pkg-f",
      ];

      const results = await Promise.all(
        packages.map((pkg) => runCli(`${tempDir}/${pkg}`, ["validate"])),
      );

      for (let i = 0; i < results.length; i++) {
        assertEquals(results[i].code, 0, `Validation failed for ${packages[i]}`);
      }
    });
  });

  describe("Edge cases with package.json", () => {
    it("should handle package with extra npm fields", async () => {
      // npm-pkg-a has dependencies, main, description - should be ignored
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["list"]);
      assertEquals(result.code, 0);
    });

    it("should handle private packages", async () => {
      // npm-pkg-b and npm-pkg-d are private
      const result = await runCli(`${tempDir}/npm-pkg-b`, ["validate"]);
      assertEquals(result.code, 0);
    });

    it("should handle packages with peer dependencies", async () => {
      // npm-pkg-c has peerDependencies
      const result = await runCli(`${tempDir}/npm-pkg-c`, ["list"]);
      assertEquals(result.code, 0);
    });

    it("should handle packages with optional dependencies", async () => {
      // npm-pkg-e has optionalDependencies
      const result = await runCli(`${tempDir}/npm-pkg-e`, ["validate"]);
      assertEquals(result.code, 0);
    });
  });

  describe("Error handling", () => {
    it("should fail for non-existent package directory", async () => {
      const result = await runCli(`${tempDir}/does-not-exist`, ["list"]);
      assertEquals(result.code, 1);
    });

    it("should fail for non-existent feature", async () => {
      const result = await runCli(`${tempDir}/npm-pkg-a`, ["check", "does-not-exist"]);
      assertEquals(result.code, 1);
    });

    it("should handle empty package directory", async () => {
      const emptyDir = `${tempDir}/empty-pkg`;
      await Deno.mkdir(emptyDir, { recursive: true });
      const result = await runCli(emptyDir, ["list"]);
      assertEquals(result.code, 1);
    });
  });
});
