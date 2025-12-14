/**
 * Multi-package CLI integration tests with deno.json
 *
 * This test creates temporary "packages" with deno.json files,
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
  // Package A: Simple features with default
  {
    name: "pkg-a",
    config: {
      name: "@test/pkg-a",
      version: "1.0.0",
      features: {
        default: ["core"],
        core: [],
        logging: [],
        debug: ["logging"],
      },
      metadata: {
        features: {
          core: { description: "Core functionality" },
          logging: { description: "Logging support" },
          debug: { description: "Debug mode", unstable: true },
        },
      },
    },
  },
  // Package B: Complex dependency chain
  {
    name: "pkg-b",
    config: {
      name: "@test/pkg-b",
      version: "2.0.0",
      features: {
        default: ["std"],
        std: ["fs", "env"],
        fs: [],
        env: [],
        net: ["async-runtime"],
        "async-runtime": [],
        full: ["std", "net", "experimental"],
        experimental: [],
      },
    },
  },
  // Package C: Deep nesting
  {
    name: "pkg-c",
    config: {
      name: "@test/pkg-c",
      version: "0.5.0",
      features: {
        default: ["level-one"],
        "level-one": ["level-two"],
        "level-two": ["level-three"],
        "level-three": ["level-four"],
        "level-four": ["leaf"],
        leaf: [],
      },
    },
  },
  // Package D: Diamond dependency pattern
  {
    name: "pkg-d",
    config: {
      name: "@test/pkg-d",
      version: "1.2.3",
      features: {
        default: ["top"],
        top: ["left", "right"],
        left: ["bottom"],
        right: ["bottom"],
        bottom: [],
        "extra-left": ["left"],
        "extra-right": ["right"],
      },
    },
  },
  // Package E: Cross-package references (dep: and pkg:feature)
  {
    name: "pkg-e",
    config: {
      name: "@test/pkg-e",
      version: "3.0.0",
      features: {
        default: ["serialization"],
        serialization: ["serde:derive"],
        async: ["dep:tokio", "tokio:full"],
        networking: ["async", "reqwest:json"],
      },
    },
  },
  // Package F: No default feature
  {
    name: "pkg-f",
    config: {
      name: "@test/pkg-f",
      version: "0.1.0",
      features: {
        alpha: [],
        beta: ["alpha"],
        gamma: ["beta"],
      },
    },
  },
];

async function createTestPackages(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "ft-flags-test-" });

  await Promise.all(
    testPackages.map(async (pkg) => {
      const pkgDir = `${dir}/${pkg.name}`;
      await Deno.mkdir(pkgDir, { recursive: true });
      await Deno.writeTextFile(
        `${pkgDir}/deno.json`,
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

describe("CLI Multi-Package Integration (deno.json)", () => {
  beforeAll(async () => {
    tempDir = await createTestPackages();
  });

  afterAll(async () => {
    if (tempDir) {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  describe("Package A: Simple features", () => {
    it("should list features correctly", async () => {
      const result = await runCli(`${tempDir}/pkg-a`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "core");
      assertStringIncludes(result.output, "logging");
      assertStringIncludes(result.output, "debug");
    });

    it("should show default as enabled", async () => {
      const result = await runCli(`${tempDir}/pkg-a`, ["check", "default"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "enabled");
    });

    it("should resolve default features", async () => {
      const result = await runCli(`${tempDir}/pkg-a`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "default");
      assertStringIncludes(result.output, "core");
    });

    it("should validate successfully", async () => {
      const result = await runCli(`${tempDir}/pkg-a`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "valid");
    });
  });

  describe("Package B: Complex dependency chain", () => {
    it("should list all features", async () => {
      const result = await runCli(`${tempDir}/pkg-b`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "std");
      assertStringIncludes(result.output, "fs");
      assertStringIncludes(result.output, "env");
      assertStringIncludes(result.output, "net");
      assertStringIncludes(result.output, "async-runtime");
      assertStringIncludes(result.output, "full");
      assertStringIncludes(result.output, "experimental");
    });

    it("should resolve full feature with all dependencies", async () => {
      const result = await runCli(`${tempDir}/pkg-b`, [
        "resolve",
        "--features",
        "full",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "full");
      assertStringIncludes(result.output, "std");
      assertStringIncludes(result.output, "fs");
      assertStringIncludes(result.output, "env");
      assertStringIncludes(result.output, "net");
      assertStringIncludes(result.output, "async-runtime");
      assertStringIncludes(result.output, "experimental");
    });

    it("should check net feature is not enabled by default", async () => {
      const result = await runCli(`${tempDir}/pkg-b`, ["check", "net"]);
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "not enabled");
    });

    it("should show correct feature tree", async () => {
      const result = await runCli(`${tempDir}/pkg-b`, ["tree", "full"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "full");
      assertStringIncludes(result.output, "std");
      assertStringIncludes(result.output, "net");
    });

    it("should resolve all features", async () => {
      const result = await runCli(`${tempDir}/pkg-b`, ["resolve", "--all-features"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "experimental");
      assertStringIncludes(result.output, "async-runtime");
    });
  });

  describe("Package C: Deep nesting", () => {
    it("should resolve entire chain from default", async () => {
      const result = await runCli(`${tempDir}/pkg-c`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "level-one");
      assertStringIncludes(result.output, "level-two");
      assertStringIncludes(result.output, "level-three");
      assertStringIncludes(result.output, "level-four");
      assertStringIncludes(result.output, "leaf");
    });

    it("should show deep tree structure", async () => {
      const result = await runCli(`${tempDir}/pkg-c`, ["tree", "level-one"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "level-one");
      assertStringIncludes(result.output, "level-two");
      assertStringIncludes(result.output, "leaf");
    });

    it("should trace enable chain correctly", async () => {
      const result = await runCli(`${tempDir}/pkg-c`, ["check", "leaf"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "enabled");
    });
  });

  describe("Package D: Diamond dependency", () => {
    it("should resolve diamond without duplicates", async () => {
      const result = await runCli(`${tempDir}/pkg-d`, ["resolve"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "top");
      assertStringIncludes(result.output, "left");
      assertStringIncludes(result.output, "right");
      assertStringIncludes(result.output, "bottom");
    });

    it("should show diamond in tree", async () => {
      const result = await runCli(`${tempDir}/pkg-d`, ["tree", "top"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "left");
      assertStringIncludes(result.output, "right");
      assertStringIncludes(result.output, "bottom");
    });

    it("should enable extra branches correctly", async () => {
      const result = await runCli(`${tempDir}/pkg-d`, [
        "resolve",
        "--features",
        "extra-left,extra-right",
        "--no-default-features",
      ]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "extra-left");
      assertStringIncludes(result.output, "extra-right");
      assertStringIncludes(result.output, "left");
      assertStringIncludes(result.output, "right");
      assertStringIncludes(result.output, "bottom");
    });
  });

  describe("Package E: Cross-package references", () => {
    it("should validate with dep: and pkg:feature references", async () => {
      const result = await runCli(`${tempDir}/pkg-e`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "valid");
    });

    it("should list features including dep references", async () => {
      const result = await runCli(`${tempDir}/pkg-e`, ["list"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "serialization");
      assertStringIncludes(result.output, "async");
      assertStringIncludes(result.output, "networking");
    });

    it("should show dep references in tree", async () => {
      const result = await runCli(`${tempDir}/pkg-e`, ["tree", "networking"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "networking");
      assertStringIncludes(result.output, "async");
    });
  });

  describe("Package F: No default feature", () => {
    it("should warn about missing default", async () => {
      const result = await runCli(`${tempDir}/pkg-f`, ["validate"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output.toLowerCase(), "default");
    });

    it("should resolve nothing by default", async () => {
      const result = await runCli(`${tempDir}/pkg-f`, ["resolve"]);
      assertEquals(result.code, 0);
      // Should show (none) or empty since no default
    });

    it("should resolve chain when explicitly enabled", async () => {
      const result = await runCli(`${tempDir}/pkg-f`, ["resolve", "--features", "gamma"]);
      assertEquals(result.code, 0);
      assertStringIncludes(result.output, "gamma");
      assertStringIncludes(result.output, "beta");
      assertStringIncludes(result.output, "alpha");
    });

    it("should check gamma not enabled by default", async () => {
      const result = await runCli(`${tempDir}/pkg-f`, ["check", "gamma"]);
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "not enabled");
    });
  });

  describe("Cross-package validation", () => {
    it("should handle multiple packages in sequence", async () => {
      const packages = ["pkg-a", "pkg-b", "pkg-c", "pkg-d", "pkg-e", "pkg-f"];

      const results = await Promise.all(
        packages.map((pkg) => runCli(`${tempDir}/${pkg}`, ["list"])),
      );

      for (let i = 0; i < results.length; i++) {
        assertEquals(results[i].code, 0, `Failed for ${packages[i]}`);
      }
    });

    it("should resolve features consistently across packages", async () => {
      const results = await Promise.all([
        runCli(`${tempDir}/pkg-a`, ["resolve"]),
        runCli(`${tempDir}/pkg-b`, ["resolve"]),
        runCli(`${tempDir}/pkg-c`, ["resolve"]),
      ]);

      for (const result of results) {
        assertEquals(result.code, 0);
      }
    });
  });

  describe("Error handling", () => {
    it("should fail gracefully for non-existent package", async () => {
      const result = await runCli(`${tempDir}/non-existent`, ["list"]);
      assertEquals(result.code, 1);
    });

    it("should fail for unknown feature check", async () => {
      const result = await runCli(`${tempDir}/pkg-a`, ["check", "nonexistent-feature"]);
      assertEquals(result.code, 1);
      assertStringIncludes(result.output, "not");
    });
  });
});
