# `ft-flags`

<div align="center" style="text-align: center;">

[![JSR](https://jsr.io/badges/@hiisi/ft-flags)](https://jsr.io/@hiisi/ft-flags)
[![npm Version](https://img.shields.io/npm/v/ft-flags?logo=npm)](https://www.npmjs.com/package/ft-flags)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ft-flags.svg)](https://github.com/hiisi-digital/ft-flags/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ft-flags?color=%23009689)

> Feature flags for TypeScript with Cargo-style feature definitions, conditional compilation, and CLI tooling.

</div>

## Overview

`ft-flags` provides a feature flag system for TypeScript that follows the same conventions as Cargo features in Rust. Features can be:

- **Declared statically** in your `deno.json` or `package.json`
- **Composed together** into feature sets
- **Enabled by default** or opt-in
- **Validated at build time** via JSON schema
- **Queried via CLI** for scripting and debugging

This package serves as the foundation for conditional compilation in the `@hiisi/cfg-ts` ecosystem.

> **Deno/JSR package:** This is the Deno-optimized version of ft-flags.
> For Node.js or Bun, see [ft-flags on npm](https://www.npmjs.com/package/ft-flags).

### Supported Runtimes

This is the Deno-optimized package. The following versions are tested in CI:

#### Deno

| 1.x | 2.x |
| :-: | :-: |
| ⚠️  | ✅  |

_1.x is best-effort due to lockfile version incompatibility_

For Node.js or Bun support, use the [npm package](https://www.npmjs.com/package/ft-flags).

## Installation

```typescript
// Import directly from JSR
import { loadManifest, resolveFeatures } from "jsr:@hiisi/ft-flags";

// Or add to your deno.json imports
// "imports": { "@hiisi/ft-flags": "jsr:@hiisi/ft-flags@^0.1.0" }
```

Or using the Deno CLI:

```bash
deno add jsr:@hiisi/ft-flags
```

## Feature Model

### Declaring Features

Features are declared at the root level of your `deno.json`. The format follows Cargo's conventions:

```json
{
  "name": "@my/package",
  "version": "1.0.0",
  "features": {
    "default": ["std"],
    "std": ["fs", "env"],
    "full": ["std", "experimental"],
    "fs": [],
    "env": [],
    "args": [],
    "experimental": ["async-runtime"],
    "async-runtime": []
  }
}
```

### Naming Conventions

Feature names follow Cargo conventions:

- **Kebab-case**: Feature names use lowercase with hyphens: `async-runtime`, `serde-support`
- **`:` for dependency features**: Enable features from dependencies: `lodash:clone`, `@scope/pkg:feature`
- **`dep:` for optional deps**: Enable optional dependencies: `dep:tokio`

> **Note:** We use `:` instead of `/` (which Cargo uses) to avoid ambiguity with scoped package names like `@scope/pkg` that are common in the JS/TS ecosystem.

### Key Concepts

#### The `default` Feature

The `default` feature is special: it lists the features that are enabled when no explicit feature selection is made. This is equivalent to Cargo's `default` feature.

```json
{
  "features": {
    "default": ["std", "logging"]
  }
}
```

To disable default features, use the `--no-default-features` CLI flag, set `FT_NO_DEFAULT_FEATURES=true` in the environment, or pass `noDefaultFeatures: true` to `resolveFeatures`.

#### Feature Dependencies

Each feature maps to an array of features it **activates**. When you enable a feature, all features it lists are also enabled (transitively).

```json
{
  "features": {
    "full": ["std", "experimental", "async-runtime"],
    "std": ["fs", "env"]
  }
}
```

Enabling `full` will enable: `full`, `std`, `experimental`, `async-runtime`, `fs`, `env`.

#### Dependency Features

Enable features from your dependencies using `:`:

```json
{
  "features": {
    "serialization": ["serde:derive", "@myorg/utils:json"],
    "async": ["tokio:full"]
  }
}
```

#### Optional Dependencies

Similar to Cargo's `dep:` syntax, you can reference optional package dependencies:

```json
{
  "features": {
    "async": ["dep:async-hooks"],
    "tracing": ["dep:opentelemetry"]
  }
}
```

_Note: `dep:` integration with package managers is planned for a future release._

### Feature Metadata

You can add metadata to features for documentation and tooling. Metadata uses the `metadata.features` namespace, following the convention used by Cargo's `[package.metadata.X]`:

```json
{
  "name": "@my/package",
  "features": {
    "default": ["std"],
    "std": ["fs", "env"],
    "experimental": []
  },
  "metadata": {
    "features": {
      "std": {
        "description": "Standard library features for cross-runtime compatibility"
      },
      "experimental": {
        "description": "Unstable features that may change",
        "unstable": true
      },
      "legacy-api": {
        "description": "Use the new API instead",
        "deprecated": true,
        "deprecatedMessage": "Migrate to v2-api feature"
      }
    }
  }
}
```

## Configuration

### Full Configuration Schema

```json
{
  "name": "@my/package",
  "features": {
    "default": ["..."],
    "feature-name": ["dependency1", "dependency2"]
  },
  "metadata": {
    "features": {
      "feature-name": {
        "description": "Human-readable description",
        "since": "1.0.0",
        "unstable": false,
        "deprecated": false,
        "deprecatedMessage": "..."
      }
    }
  }
}
```

### Environment Variables

Override features at runtime via environment variables:

```bash
# Enable specific features
FT_FEATURES=experimental,async-runtime

# Disable default features
FT_NO_DEFAULT_FEATURES=true

# Enable all features
FT_ALL_FEATURES=true
```

### CLI Arguments

Pass feature flags via command line:

```bash
my-app --features experimental,async-runtime
my-app --no-default-features
my-app --all-features
```

## CLI Tool

`ft-flags` includes a CLI (`ft`) for querying and validating features.

### Installation

```bash
# global install
deno install -g -A -n ft jsr:@hiisi/ft-flags/cli

# or run directly
deno run -A jsr:@hiisi/ft-flags/cli <command>

# or via a deno task, if your project defines one
deno task ft <command>
```

### Commands

#### `ft list`

List all available features for the current package, sorted alphabetically.

```bash
$ ft list
Available features:

  args -> []
  async-runtime -> []
  default -> [std]
  env -> []
  experimental -> [async-runtime]
  fs -> []
  full -> [std, experimental]
  std -> [fs, env]

$ ft list --enabled
Enabled features:

  [ok] default
  [ok] env (via: default -> std -> env)
  [ok] fs (via: default -> std -> fs)
  [ok] std (via: default -> std)

Disabled features:
  [ ] args
  [ ] async-runtime
  [ ] experimental
  [ ] full
```

#### `ft check <feature>`

Check if a specific feature is enabled.

```bash
$ ft check fs
[ok] fs is enabled (via: default -> std -> fs)

$ ft check experimental
[x] experimental is not enabled

$ ft check experimental --features experimental
[ok] experimental is enabled (explicit)
```

Exit codes: `0` if enabled, `1` if disabled.

#### `ft resolve`

Show the fully resolved set of enabled features, sorted alphabetically. The command also prints the resolution options in effect.

```bash
$ ft resolve
Resolved features:

  default, env, fs, std

$ ft resolve --features full --no-default-features
Resolved features:

  async-runtime, env, experimental, fs, full, std

$ ft resolve --all-features
Resolved features:

  args, async-runtime, default, env, experimental, fs, full, std
```

#### `ft tree [feature]`

Display the feature dependency tree.

```bash
$ ft tree
Feature tree:

default
`-- std
    |-- fs
    `-- env
full
|-- std
|   |-- fs
|   `-- env
`-- experimental
    `-- async-runtime
args

$ ft tree full
Feature tree:

full
|-- std
|   |-- fs
|   `-- env
`-- experimental
    `-- async-runtime
```

#### `ft validate`

Validate the feature configuration.

```bash
$ ft validate
[ok] Configuration is valid

$ ft validate
Errors:
  [x] Feature "std" references unknown feature "nonexistent"
  [x] Circular dependency detected: full -> experimental -> full
```

### Package-Specific Queries

Query features for a package in another directory. The `--package` flag takes a path to a directory containing a `deno.json` or `package.json`:

```bash
$ ft list --package ./packages/my-lib
$ ft check fs --package ./packages/my-lib
```

## Programmatic API

### Basic Usage

```typescript
import {
  isFeatureEnabled,
  listAvailableFeatures,
  loadManifest,
  resolveFeatures,
} from "@hiisi/ft-flags";

// Load features from deno.json. This returns null when no manifest declares
// any, so it is checked before use rather than after a type error.
const manifest = await loadManifest();
if (!manifest) throw new Error("no features declared in deno.json");

// Resolve with default features
const resolved = resolveFeatures(manifest);

// Check if a feature is enabled
if (isFeatureEnabled("fs", resolved)) {
  // Use filesystem features
}

// List all available features
const available = listAvailableFeatures(manifest);
console.log(available); // sorted: ["default", "env", "fs", ...]
```

### Custom Feature Selection

```typescript
import { resolveFeatures } from "@hiisi/ft-flags";

// Enable specific features, no defaults
const resolved = resolveFeatures(manifest, {
  features: ["experimental", "fs"],
  noDefaultFeatures: true,
});

// Enable all features
const all = resolveFeatures(manifest, {
  allFeatures: true,
});
```

### Using the Registry API

```typescript
import { buildSchema, createRegistry, featureId, isEnabled } from "@hiisi/ft-flags";

// Define features with schema
const schema = buildSchema([
  { id: "fs", description: "File system access" },
  { id: "env", description: "Environment variable access" },
  { id: "async-runtime", description: "Async runtime support" },
]);

// Create registry with enabled features
const registry = createRegistry({
  schema,
  config: {
    enabled: ["fs", "env"],
  },
});

// Type-safe feature checks
if (isEnabled(registry, featureId("fs"))) {
  // ...
}
```

### Schema Validation

```typescript
import { parseManifest, validateManifest } from "@hiisi/ft-flags";

const manifest = parseManifest({
  features: {
    default: ["std"],
    std: ["unknown-feature"], // error: unknown reference
  },
});

const result = validateManifest(manifest);
if (!result.valid) {
  console.error(result.errors);
  // ['Feature "std" references unknown feature "unknown-feature"']
}
```

## JSON Schema

A JSON schema is provided for editor validation and autocompletion.

### VS Code / Editors

Add to your `settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["deno.json", "package.json"],
      "url": "https://jsr.io/@hiisi/ft-flags/0.1.2/schema.json"
    }
  ]
}
```

### Schema URL

JSR serves package files under a version path, so the URL carries the version:

```
https://jsr.io/@hiisi/ft-flags/0.1.2/schema.json
```

## Integration with cfg-ts

`cfg-ts` is meant to consume these flags for conditional compilation. **It is not
published yet**, so the shape below is what it will look like rather than something you
can install today:

```typescript
// @cfg(feature("fs"))
export function readFile(path: string): string {
  return Deno.readTextFileSync(path); // only compiled in when fs is enabled
}

// @cfg(not(feature("experimental")))
export function stableApi(): void {
  // only compiled in when experimental is NOT enabled
}

// @cfg(all(feature("std"), not(feature("legacy"))))
export function modernStdLib(): void {
  // predicates compose
}
```

## Comparison with Cargo

| Cargo                   | ft-flags                | Notes                                |
| ----------------------- | ----------------------- | ------------------------------------ |
| `[features]`            | `"features": {}`        | Same concept                         |
| `default = ["std"]`     | `"default": ["std"]`    | Same semantics                       |
| `foo = ["bar", "baz"]`  | `"foo": ["bar", "baz"]` | Feature enables others               |
| `dep:optional-dep`      | `"dep:pkg-name"`        | Optional dependency                  |
| `serde/derive`          | `"serde:derive"`        | Dep feature ref (`:` instead of `/`) |
| `--features foo`        | `--features foo`        | CLI flag                             |
| `--no-default-features` | `--no-default-features` | Disable defaults                     |
| `--all-features`        | `--all-features`        | Enable everything                    |

## Related Packages

- [`@hiisi/onlywhen`](https://jsr.io/@hiisi/onlywhen) - Runtime feature detection

Not published yet, so there is nothing to link: `cfg-ts` for `@cfg()` conditional
compilation, `otso` for feature-driven builds, and `tgts` for target definitions.

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license [here](https://github.com/hiisi-digital/ft-flags/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
