import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

/** Exercise the real D1 Drizzle adapter against SQLite, including RETURNING. */
export function authDatabase(beforeAuthMigration?: (sqlite: DatabaseSync) => void) {
  const sqlite = new DatabaseSync(":memory:");
  for (const path of readdirSync("drizzle").filter((file) => file.endsWith(".sql")).sort()) {
    if (path === "0005_trace_accounts.sql") beforeAuthMigration?.(sqlite);
    sqlite.exec(readFileSync(`drizzle/${path}`, "utf8"));
  }
  const statement = (query: string, values: SQLInputValue[] = []): D1PreparedStatement => {
    const prepared = sqlite.prepare(query);
    return {
      bind: (...args: SQLInputValue[]) => statement(query, args),
      first: async (column?: string) => {
        const row = prepared.get(...values);
        return column ? row?.[column] ?? null : row ?? null;
      },
      run: async () => { prepared.run(...values); return { success: true, results: [], meta: {} }; },
      all: async () => ({ success: true, results: prepared.all(...values), meta: {} }),
      raw: async (options?: { columnNames?: boolean }) => {
        const rows = prepared.all(...values).map((row) => Object.values(row));
        return options?.columnNames ? [prepared.columns().map((column) => column.name), ...rows] : rows;
      },
    } as unknown as D1PreparedStatement;
  };
  const binding = { prepare: statement, batch: async (statements: D1PreparedStatement[]) => Promise.all(statements.map((query) => query.all())) } as unknown as D1Database;
  return { sqlite, db: drizzle(binding, { schema }) };
}
