/**
 * What this package has to be true of before anything may be committed.
 *
 * Deliberately harsher than the code currently is. A lint set tuned to what
 * already passes measures nothing, and the point of putting it here is that it
 * refuses work rather than describes it.
 *
 * @module
 */

import defaultLints from "@hiisi/viola-default-lints";
import typescript from "@hiisi/viola-grammar-ts";
import { report, viola, when } from "@hiisi/viola";

export default viola()
  .use(defaultLints)
  // the grammar is what turns a file into something a lint can ask questions
  // of. the alias defaults to the grammar's own id, so naming it "typescript"
  // said the same thing twice.
  .add(typescript)
  // anything a linter has any confidence in at all is a failure. a warning
  // is a finding nobody acts on, and a gate that warns is not a gate. the
  // floor was 50 and everything under it passed silently.
  .rule(report.error, when.confidence.atLeast(1))
  // tests are held to the same bar as source. a fixture that drifts is how a
  // suite stops measuring the thing it names.
  .rule(report.error, when.in("tests/**/*.ts"))
  // fixtures that are supposed to be wrong are the one exception, since being
  // wrong is their entire job.
  .rule(report.off, when.in("tests/compile_fail/**"))
  .rule(report.off, when.in("**/fixtures/**"))
  // a literal spelled out across several test cases is several tests each
  // asserting its own expected value. counting those toward a duplication
  // threshold asks for a shared constant, and a test comparing a constant to
  // itself has stopped testing anything. they still show in the locations
  // list, they just do not push a string over the threshold on their own.
  .set("duplicate-strings.countIn", [
    "**",
    "!**/*_test.ts",
    "!**/*.test.ts",
    "!**/tests/**",
    "!**/fixtures/**",
  ])
  // This package is about feature flags, and `deprecated` is one of the fields a
  // flag's own metadata carries: a consumer marks *their* feature deprecated and
  // this reads it back. The lint's premise, that deprecated code should be
  // deleted rather than marked, is right about code and does not describe a
  // schema field named after the thing it records.
  // The config itself names the patterns, so it trips the lint it is
  // configuring. Excluded by file rather than by pattern, since every mention
  // in here is by construction about the check rather than about code.
  .set("deprecation-check.excludeFiles", [/viola\.config\.ts$/])
  .set("deprecation-check.falsePositivePatterns", [
    /\bdeprecated\??:/,
    /\bdeprecatedMessage\b/,
    /\bdeprecationMessage\b/,
    /metadata\.deprecated\b/,
    /meta\?\.deprecated\b/,
    /"\(deprecated\)"/,
    /\* Whether this feature is deprecated/,
    /\* Message to show when feature is deprecated/,
    /marked deprecated but has no deprecation message/,
    /meta\.deprecated\b/,
  ])
  // `scripts/` is build tooling that never ships.
  .rule(report.off, when.in("scripts/**"))
  // `isEnabled` and `isDisabled` are re-exported by `mod.ts` with
  // `export { ... } from "./src/evaluate.ts"` and used 44 and 6 times. viola's
  // reachability walk does not follow a named re-export, so it reads them as
  // orphaned. Filed upstream; this says what `mod.ts` already says.
  .set("orphaned-code.entryPointPatterns", [/^src\/evaluate$/, /^src\/cli$/, /^src\/manifest$/])
  // `bold`, `yellow` and `green` are the colour names `colorize` takes, written
  // where a reader can see which colour a line will be. `[ok]`, ` -> ` and
  // `--features=` are output the tests match on, so a constant would move the
  // thing being asserted away from the assertion.
  .set("duplicate-strings.ignoreStrings", [
    "bold",
    "yellow",
    "green",
    "[ok]",
    " -> ",
    "--features=",
  ])
  // `ValidationResult` is a schema check's answer and `ManifestValidation` is a
  // manifest's. They carry the same three fields because both answer the same
  // question about different things, and one type for both would let a schema
  // result be returned where a manifest result is expected.
  .set("similar-types.ignoreTypes", ["ValidationResult", "ManifestValidation"])
  // `registry.ts` and `manifest.ts` are two surfaces over the same idea: one
  // works from a built registry, the other from a resolved manifest. The shared
  // names are deliberate, and neither module calls the other's.
  .set("similar-functions.ignoreFunctions", [
    "requireFeature",
    "listEnabledFeatures",
    "listDisabledFeatures",
  ]);
