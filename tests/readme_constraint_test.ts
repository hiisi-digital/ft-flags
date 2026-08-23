/**
 * The version the readme tells a reader to depend on is the version this is.
 *
 * A caret on a `0.x` version pins the minor, so `^0.1.0` never reaches 0.2.0.
 * That is what the readme said while the package was 0.2.0: anybody following
 * it got 0.1.x forever, nothing failed, nothing warned, and the only symptom
 * was people running an old package and reporting bugs that were already fixed.
 *
 * The template in `scripts/generate_readme.ts` derives the constraint from the
 * manifest now, so the two cannot drift there. This checks the committed
 * `README.md`, which is a separate file nothing regenerates.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";

const ROOT = new URL("../", import.meta.url);

function manifestVersion(): string {
  const version = JSON.parse(Deno.readTextFileSync(new URL("deno.json", ROOT))).version;
  assert(typeof version === "string" && version.length > 0, "the manifest names no version");
  return version;
}

Deno.test("every constraint the readme documents for this package matches its version", () => {
  const version = manifestVersion();
  const readme = Deno.readTextFileSync(new URL("README.md", ROOT));

  // every place the readme names this package with a version, whatever the
  // surrounding syntax. An install line, an imports block and a prose mention
  // are three shapes and all three go stale the same way.
  const named = [...readme.matchAll(/@hiisi\/ft-flags@(\^|~)?(\d+\.\d+\.\d+)/g)];
  assert(named.length > 0, "the readme names no version for this package at all");

  for (const [whole, op, want] of named) {
    if (op === undefined) {
      // an exact pin in documentation is a different claim and has to be exact
      assertEquals(want, version, `${whole} pins a version this package is not`);
      continue;
    }
    // caret and tilde both pin the minor below 1.0, so the documented minor
    // has to be this one or a reader never reaches it
    const [wMajor, wMinor] = want.split(".");
    const [hMajor, hMinor] = version.split(".");
    assertEquals(
      `${wMajor}.${wMinor}`,
      `${hMajor}.${hMinor}`,
      `${whole} cannot resolve to ${version}, because ${op} pins the minor below 1.0`,
    );
  }
});
