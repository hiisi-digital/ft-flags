/**
 * What toggling costs, one flag at a time against all of them at once.
 *
 * The registry is immutable: every state change copies the whole state map and returns a
 * new registry. That is the right shape for the data and the wrong cost for a loop, since
 * setting N flags copies the map N times and is quadratic in the number of flags.
 *
 * Reading is a single `Map.get` and is measured here only to say so.
 *
 * @module
 */

import {
  createSimpleRegistry,
  featureId,
  isEnabled,
  setFeatureState,
  setFeatureStates,
} from "../mod.ts";

/** Registry sizes worth distinguishing: a small crate, a large one, a monorepo. */
const SIZES = [16, 128, 1024];

for (const size of SIZES) {
  const ids = Array.from({ length: size }, (_, n) => featureId(`feature-${n}`));
  const registry = createSimpleRegistry(ids as unknown as string[]);

  Deno.bench({
    name: `set every flag one at a time (${size} flags)`,
    group: `toggle ${size}`,
    baseline: true,
    fn(): void {
      let current = registry;
      for (const id of ids) {
        current = setFeatureState(current, id, true);
      }
    },
  });

  Deno.bench({
    name: `set every flag in one call (${size} flags)`,
    group: `toggle ${size}`,
    fn(): void {
      setFeatureStates(registry, ids.map((id) => [id, true] as const));
    },
  });
}

const ids = Array.from({ length: 1024 }, (_, n) => featureId(`feature-${n}`));
const registry = createSimpleRegistry(ids as unknown as string[]);

Deno.bench("read one flag", () => {
  isEnabled(registry, featureId("feature-512"));
});
