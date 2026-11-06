import { randomBytes } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { parseEnv } from "node:util";

// All credential writers share a queue so simultaneous saves preserve each other.
const queues = new Map<string, Promise<unknown>>();
export async function readEnv(file: string) {
  try { return await readFile(file, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw new Error("Could not read the local .env file.");
  }
}
export async function envValues(file: string) { return parseEnv(await readEnv(file)); }
export function updateEnv(file: string, names: string[], values: Record<string, string> = {}) {
  const task = (queues.get(file) ?? Promise.resolve()).then(async () => {
    const current = await readEnv(file);
    const eol = current.includes("\r\n") ? "\r\n" : "\n";
    const assignment = new RegExp('^[\\t ]*(?:export[\\t ]+)?(?:' + names.join("|") + ')[\\t ]*=[\\t ]*(?:"(?:\\\\.|[^"\\\\])*"|\'[^\']*\'|`[^`]*`|[^\\r\\n]*)[^\\r\\n]*(?:\\r?\\n|$)', "gm");
    let next = current.replace(assignment, "");
    for (const [name, value] of Object.entries(values)) {
      if (!names.includes(name) || /[\r\n"'\\#`]/.test(value)) throw new Error("Invalid credential value.");
      if (next && !next.endsWith("\n")) next += eol;
      next += `${name}="${value}"${eol}`;
    }
    if (next === current) return;
    const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await writeFile(temporary, next, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporary, file);
    } finally { await unlink(temporary).catch(() => {}); }
  });
  queues.set(file, task.catch(() => {}));
  return task;
}
