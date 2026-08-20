/**
 * Setting several feature states at once.
 *
 * The registry is immutable, so every state change copies the state map. Setting flags one
 * at a time therefore copies it once per flag: measured in `benches/registry_bench.ts`,
 * applying 1024 flags one at a time takes 41 ms against 60 microseconds in one call, which is 690
 * times the cost for the same result.
 *
 * @module
 */

import { assertEquals } from "@std/assert";
import {
  createSimpleRegistry,
  featureId,
  isEnabled,
  listEnabledFeatures,
  setFeatureState,
  setFeatureStates,
} from "../mod.ts";

const NAMES = ["alpha", "beta", "gamma", "delta"];

/** `createSimpleRegistry` enables everything it is given, so these turn flags off. Setting
 * them on would assert against a state they already hold, which is a test that cannot
 * fail. */
function registry(): ReturnType<typeof createSimpleRegistry> {
  return createSimpleRegistry(NAMES);
}

Deno.test("setFeatureStates applies every entry", () => {
  const updated = setFeatureStates(registry(), [
    [featureId("alpha"), false],
    [featureId("gamma"), false],
  ]);
  assertEquals(isEnabled(updated, featureId("alpha")), false);
  assertEquals(isEnabled(updated, featureId("gamma")), false);
  assertEquals(isEnabled(updated, featureId("beta")), true, "and the rest are untouched");
  assertEquals(isEnabled(updated, featureId("delta")), true);
});

Deno.test("setFeatureStates leaves the original registry alone", () => {
  const original = registry();
  setFeatureStates(original, [[featureId("alpha"), false]]);
  assertEquals(
    isEnabled(original, featureId("alpha")),
    true,
    "the registry is immutable, so a bulk update is no exception to that",
  );
});

Deno.test("a later entry wins over an earlier one for the same flag", () => {
  // What a caller layering defaults, then a config file, then a command line expects.
  const updated = setFeatureStates(registry(), [
    [featureId("alpha"), false],
    [featureId("alpha"), true],
  ]);
  assertEquals(isEnabled(updated, featureId("alpha")), true);
});

Deno.test("setFeatureStates accepts any iterable, not only an array", () => {
  function* entries(): Generator<readonly [ReturnType<typeof featureId>, boolean]> {
    yield [featureId("beta"), false];
    yield [featureId("delta"), false];
  }
  const updated = setFeatureStates(registry(), entries());
  assertEquals(listEnabledFeatures(updated).length, NAMES.length - 2);
});

Deno.test("an empty list changes nothing", () => {
  const updated = setFeatureStates(registry(), []);
  assertEquals(listEnabledFeatures(updated).length, NAMES.length);
});

Deno.test("the bulk form and the single form agree", () => {
  // `setFeatureState` is `setFeatureStates` with one entry, so the two cannot disagree
  // about what a state record contains. This is what says so.
  const one = setFeatureState(registry(), featureId("beta"), false);
  const many = setFeatureStates(registry(), [[featureId("beta"), false]]);
  assertEquals(
    JSON.stringify([...many.states.entries()]),
    JSON.stringify([...one.states.entries()]),
  );
});
