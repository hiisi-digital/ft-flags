# `ft-flags`

<div align="center" style="text-align: center;">

[![JSR](https://jsr.io/badges/@hiisi/ft-flags)](https://jsr.io/@hiisi/ft-flags)
[![npm Version](https://img.shields.io/npm/v/ft-flags?logo=npm)](https://www.npmjs.com/package/ft-flags)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ft-flags.svg)](https://github.com/hiisi-digital/ft-flags/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ft-flags?color=%23009689)

> Feature flags for TypeScript with Cargo-style feature definitions, conditional compilation, and CLI tooling.

</div>

## Overview

`ft-flags` provides a robust feature flag system for TypeScript that follows the same conventions as Cargo features in Rust. Features can be:

- **Declared statically** in your `deno.json` or `package.json`
- **Composed together** into feature sets
- **Enabled by default** or opt-in
- **Validated at build time** via JSON schema
- **Queried via CLI** for scripting and debugging

This package serves as the foundation for conditional compilation in the `@hiisi/cfg-ts` ecosystem.

## Installation

```bash
# Deno
deno add jsr:@hiisi/ft-flags

# npm / yarn / pnpm
npm install ft-flags
```

## Feature Model

### Declaring Features

Features are declared at the root level of your `deno.json` or `package.json`. The format follows Cargo's conventions:

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

The `default` feature is special — it lists the features that are enabled when no explicit feature selection is made. This is equivalent to Cargo's `default` feature.

```json
{
  "features": {
    "default": ["std", "logging"]
  }
}
```

To disable default features, use the `--no-default-features` CLI flag or set `defaultFeatures: false` in your config.

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
# Global install via Deno
deno install -A -n ft jsr:@hiisi/ft-flags/cli

# Or run directly
deno run -A jsr:@hiisi/ft-flags/cli <command>

# Or via deno task (when in a project with ft-flags)
deno task ft <command>
```

### Commands

#### `ft list`

List all available features for the current package.

```bash
$ ft list
Available features:
  default       -> [std]
  std           -> [fs, env]
  fs            -> []
  env           -> []
  experimental  -> []

$ ft list --enabled
Enabled features (with default):
  [ok] default
  [ok] std
  [ok] fs
  [ok] env
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

Show the fully resolved set of enabled features.

```bash
$ ft resolve
Resolved features:
  default, std, fs, env

$ ft resolve --features full --no-default-features
Resolved features:
  full, std, experimental, async-runtime, fs, env

$ ft resolve --all-features
Resolved features:
  default, std, full, experimental, async-runtime, fs, env, args
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
[x] Error: Circular dependency detected: full -> experimental -> full
[x] Error: Unknown feature referenced: "nonexistent" in feature "std"
```

### Package-Specific Queries

Query features for a specific package in a workspace:

```bash
$ ft list --package @myorg/subpackage
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

// Load features from deno.json or package.json
const manifest = await loadManifest();

// Resolve with default features
const resolved = resolveFeatures(manifest);

// Check if a feature is enabled
if (isFeatureEnabled("fs", resolved)) {
  // Use filesystem features
}

// List all available features
const available = listAvailableFeatures(manifest);
console.log(available); // ["default", "std", "fs", ...]
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
import { validateManifest } from "@hiisi/ft-flags";

const result = validateManifest({
  features: {
    default: ["std"],
    std: ["unknown-feature"], // Error!
  },
});

if (!result.valid) {
  console.error(result.errors);
  // ["Unknown feature 'unknown-feature' referenced in 'std'"]
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
      "url": "https://jsr.io/@hiisi/ft-flags/schema.json"
    }
  ]
}
```

### Schema URL

```
https://jsr.io/@hiisi/ft-flags/schema.json
```

## Integration with cfg-ts

`ft-flags` is designed to work with `@hiisi/cfg-ts` for conditional compilation:

```typescript
import { cfg } from "@hiisi/cfg-ts";

// @cfg(feature("fs"))
export function readFile(path: string): string {
  // This function is only included when fs is enabled
}

// @cfg(not(feature("experimental")))
export function stableApi(): void {
  // Only included when experimental is NOT enabled
}

// @cfg(all(feature("std"), not(feature("legacy"))))
export function modernStdLib(): void {
  // Complex predicates
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

- [`@hiisi/cfg-ts`](https://jsr.io/@hiisi/cfg-ts) - Conditional compilation with `@cfg()` syntax
- [`@hiisi/otso`](https://jsr.io/@hiisi/otso) - Build framework that orchestrates feature-based builds
- [`@hiisi/tgts`](https://jsr.io/@hiisi/tgts) - Target definitions (runtime, platform, arch)
- [`@hiisi/onlywhen`](https://jsr.io/@hiisi/onlywhen) - Runtime feature detection

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license [here](https://github.com/hiisi-digital/ft-flags/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
