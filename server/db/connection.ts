import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.ts";

const DB_PATH = resolve(import.meta.dir, "..", "..", "data", "magicv.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const sqlite = new Database(DB_PATH);
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

const MIGRATIONS_DIR = resolve(import.meta.dir, "..", "..", "drizzle");
migrate(db, { migrationsFolder: MIGRATIONS_DIR });
