# `ft-flags`

<div align="center" style="text-align: center;">

[![JSR](https://jsr.io/badges/@hiisi/ft-flags)](https://jsr.io/@hiisi/ft-flags)
[![npm Version](https://img.shields.io/npm/v/ft-flags?logo=npm)](https://www.npmjs.com/package/ft-flags)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/ft-flags.svg)](https://github.com/hiisi-digital/ft-flags/issues)
![License](https://img.shields.io/github/license/hiisi-digital/ft-flags?color=%23009689)

> Feature flag definitions and evaluation for TypeScript - the foundation for conditional compilation based on features.

</div>

## What it does

`ft-flags` provides a robust feature flag system for TypeScript applications. It defines how features are declared, evaluated, and composed, serving as the foundation for feature-based conditional compilation.

This package includes:

- **Feature flag schema** with validation and type safety
- **Feature evaluation** at both runtime and compile-time
- **Feature composition** with boolean logic (all, any, not)
- **Configuration loading** from various sources (config files, environment, CLI)

It integrates with `@hiisi/cfg-ts` to enable `@cfg(feature("my.feature"))` syntax for conditional compilation.

## Installation

```bash
# Deno
deno add jsr:@hiisi/ft-flags

# npm / yarn / pnpm
npm install ft-flags
```

## Related Packages

- [`@hiisi/otso`](https://jsr.io/@hiisi/otso) - The build framework that orchestrates feature flags
- [`@hiisi/cfg-ts`](https://jsr.io/@hiisi/cfg-ts) - The @cfg decorator that consumes feature predicates
- [`@hiisi/tgts`](https://jsr.io/@hiisi/tgts) - Target definitions (runtime, platform, arch)
- [`@hiisi/onlywhen`](https://jsr.io/@hiisi/onlywhen) - Runtime detection and conditional execution

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license [here](https://github.com/hiisi-digital/ft-flags/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
