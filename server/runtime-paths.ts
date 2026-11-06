import path from "node:path";

/** Keep VM credentials and mutable state outside the deployed checkout. */
export function runtimePaths(root: string, dataDirectory = process.env.RECEIPT_DATA_DIR) {
  const state = dataDirectory ? path.resolve(dataDirectory) : path.join(root, ".local");
  return {
    credentials: dataDirectory ? path.join(state, ".env") : path.join(root, ".env"),
    ai: path.join(state, "ai"),
    reminders: path.join(state, "reminders"),
  };
}
