/**
 * The README's TypeScript examples type-check.
 *
 * They are generated from template literals in `scripts/generate_readme.ts`,
 * which means the compiler never sees them: a string containing broken code is
 * still a valid string. Two examples shipped broken for exactly that reason.
 * The first usage example in the readme passed a `FeatureManifest | null`
 * straight into a function wanting a `FeatureManifest`, so anyone pasting it
 * got two type errors on their first contact with this package.
 *
 * This test extracts every fenced `typescript` block and checks it as the
 * reader would, with this repo's own import map.
 *
 * A block is allowed to reference names it never defines: an illustrative
 * snippet does that on purpose, and demanding otherwise would push the readme
 * toward complete programs nobody wants to read. So `TS2304` and `TS2552`,
 * which are exactly "you used a name that is not declared", do not fail this
 * test. Everything else does, because everything else is the readme being
 * wrong about the package.
 *
 * @module
 */

import { assertEquals } from "@std/assert";

/** One fenced block, with the readme line it starts on for the failure message. */
interface Block {
  readonly line: number;
  readonly code: string;
}

/** Diagnostic codes that mean "undeclared name", which a snippet may have. */
const SNIPPET_CODES = new Set(["TS2304", "TS2552"]);

function typescriptBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const fence = /^```(typescript|ts|tsx)\n([\s\S]*?)^```/gm;
  for (const m of markdown.matchAll(fence)) {
    blocks.push({
      line: markdown.slice(0, m.index).split("\n").length,
      code: m[2],
    });
  }
  return blocks;
}

/** Every diagnostic code deno reported, with the colour stripped. */
function hardErrors(output: string): string[] {
  // deno colourises, so an anchored match against the raw stream never fires
  // and every failure reads as a snippet. This cost a whole audit pass once.
  // The escape has to go with the bracket part: stripping only the brackets
  // leaves "\x1bTS2307", so ^ still does not match. Harmless here only
  // because whether deno colours a piped stream depends on the environment;
  // in four other repos taking this same test the control did not turn red.
  // deno-lint-ignore no-control-regex
  const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
  const codes = [...plain.matchAll(/^(TS\d+)\s*\[ERROR\]/gm)].map((m) => m[1]);
  return codes.filter((c) => !SNIPPET_CODES.has(c));
}

Deno.test("every README typescript example type-checks", async () => {
  const markdown = await Deno.readTextFile(
    new URL("../README.md", import.meta.url),
  );
  const blocks = typescriptBlocks(markdown);

  // If the readme stops having examples, this test has stopped testing
  // anything, and should say so rather than passing quietly.
  if (blocks.length === 0) throw new Error("no typescript blocks in README.md");

  const dir = await Deno.makeTempDir({ dir: new URL(".", import.meta.url).pathname });
  let broken: string[] = [];
  try {
    // Checked in parallel: each block is independent, and a serial loop spends
    // a compiler startup per example for no reason.
    const results = await Promise.all(blocks.map(async (block) => {
      const file = `${dir}/readme_L${block.line}.ts`;
      await Deno.writeTextFile(file, block.code);
      const { stderr, success } = await new Deno.Command(Deno.execPath(), {
        args: ["check", file],
        stderr: "piped",
        stdout: "null",
      }).output();
      if (success) return null;
      const codes = hardErrors(new TextDecoder().decode(stderr));
      if (codes.length === 0) return null;
      return `README.md:${block.line} -> ${[...new Set(codes)].join(", ")}`;
    }));
    broken = results.filter((r): r is string => r !== null).sort();
  } finally {
    await Deno.remove(dir, { recursive: true });
  }

  assertEquals(
    broken,
    [],
    `README examples that do not compile:\n  ${broken.join("\n  ")}\n` +
      "These are generated from scripts/generate_readme.ts; fix them there and regenerate.",
  );
});
