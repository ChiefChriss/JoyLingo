/** Executable entry: open the DB, seed on first boot, listen. */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
import { openDb } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { buildServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "127.0.0.1";
// Persistent by default; API_DATA_DIR=memory:// for throwaway runs.
const DATA_DIR =
  process.env.API_DATA_DIR ?? fileURLToPath(new URL("../.data", import.meta.url));

const db = await openDb(DATA_DIR);
const seeded = await seedIfEmpty(db);
const app = buildServer({ db });
if (seeded > 0) app.log.info(`seeded ${seeded} episode(s) from the static manifest`);
await app.listen({ port: PORT, host: HOST });
