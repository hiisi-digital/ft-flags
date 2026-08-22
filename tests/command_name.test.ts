/**
 * The command this package installs is the one its own text tells you to type.
 *
 * `bin` in the config decides what lands on the PATH; the help and the usage
 * lines decide what a reader types next. Nothing connects them, so they drift,
 * and the drift is invisible from either side: the manifest is right about the
 * command and the help is right about the tool, and only somebody holding both
 * at once notices.
 *
 * This package had drifted. The help printed `ft`, a module doc and an error
 * message said `ft-flags`, and no installer produces a command by that name.
 *
 * @module
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";

const ROOT = new URL("../", import.meta.url);

async function config(): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(new URL("deno.json", ROOT)));
}

function bin(c: Record<string, unknown>): Record<string, string> {
  return (c["bin"] ?? {}) as Record<string, string>;
}

Deno.test("the config declares exactly one command, pointing at a file that exists", async () => {
  const declared = bin(await config());
  const names = Object.keys(declared);
  assertEquals(names.length, 1, `expected one command, found: ${names.join(", ") || "none"}`);
  const path = declared[names[0] ?? ""] ?? "";
  const stat = await Deno.stat(new URL(path, ROOT));
  assert(stat.isFile, `bin points at ${path}, which is not a file`);
});

Deno.test("the command is also a declared export, so deno can install it", async () => {
  // `deno install` takes an export rather than a bin field, so a command that is
  // not exported installs under node and bun and not under deno
  const c = await config();
  const target = Object.values(bin(c))[0] ?? "";
  const exports = Object.values(c["exports"] as Record<string, string>);
  assert(
    exports.includes(target),
    `${target} is a command but not an export, so deno cannot install it`,
  );
});

Deno.test("the help tells the reader to type the command that gets installed", async () => {
  const c = await config();
  const command = Object.keys(bin(c))[0] ?? "";
  const entry = Object.values(bin(c))[0] ?? "";

  const { stdout } = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", new URL(entry, ROOT).pathname, "help"],
    stdout: "piped",
    stderr: "null",
  }).output();

  assertStringIncludes(new TextDecoder().decode(stdout), `${command} <command>`);
});

Deno.test("no usage line names something that is not the installed command", async () => {
  const c = await config();
  const command = Object.keys(bin(c))[0] ?? "";

  // Two shapes carry a command name to a reader, and both had drifted here: a
  // usage-example line, which begins with the command, and a `Usage:` prefix in
  // an error. Prose mentioning the package by name is not either of those and is
  // deliberately not matched.
  const example = new RegExp(String.raw`^\s*(?:\*\s+|\s{3,})([\w-]+)\s+[a-z<[]`);
  const usage = /Usage:\s*([\w-]+)/;

  const offenders: string[] = [];
  for await (const entry of Deno.readDir(new URL("src/", ROOT))) {
    if (!entry.name.endsWith(".ts")) continue;
    const text = await Deno.readTextFile(new URL(`src/${entry.name}`, ROOT));
    for (const [index, line] of text.split("\n").entries()) {
      for (const named of [example.exec(line)?.[1], usage.exec(line)?.[1]]) {
        // only a name that looks like this package's, so ordinary prose and
        // unrelated words in an indented block do not become failures
        if (named === undefined) continue;
        if (named === command) continue;
        if (!named.includes(command)) continue;
        offenders.push(`src/${entry.name}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assertEquals(offenders, [], `these tell the reader to type something no installer produces`);
});
