/**
 * Helpers shared by the integration suites here.
 *
 * `runCli` existed twice, byte for byte. The fixtures each suite builds are
 * genuinely different and stay where they are; the way they invoke the cli is
 * not, and two copies of that is two ways for one suite to start passing
 * different arguments than the other while both read as if they agreed.
 *
 * @module
 */

/** Run the cli against one package and collect what it printed. */
export async function runCli(
  packagePath: string,
  args: string[],
): Promise<{ code: number; output: string }> {
  const cliPath = new URL("../../src/cli.ts", import.meta.url).pathname;

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-env",
      cliPath,
      "--package",
      packagePath,
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
    env: { NO_COLOR: "1" }, // colours off, so assertions read the text
  });

  const process = await command.output();
  const stdout = new TextDecoder().decode(process.stdout);
  const stderr = new TextDecoder().decode(process.stderr);

  return { code: process.code, output: stdout + stderr };
}

/** One package a fixture builds. */
export interface TestPackage {
  name: string;
  config: Record<string, unknown>;
}
