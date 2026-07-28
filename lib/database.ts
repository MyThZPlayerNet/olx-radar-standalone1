import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type DatabaseResult<T = unknown> = {
  meta?: {
    changes?: number;
  };
  results?: T[];
  success?: boolean;
};

export interface DatabaseStatement {
  all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
  bind(...values: unknown[]): DatabaseStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
}

export interface DatabaseLike {
  batch<T = Record<string, unknown>>(
    statements: DatabaseStatement[],
  ): Promise<DatabaseResult<T>[]>;
  prepare(query: string): DatabaseStatement;
}

type SqliteValue = string | number | bigint | Uint8Array | null;

function sqliteValue(value: unknown): SqliteValue {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  throw new TypeError(`Nieobsługiwany typ parametru SQLite: ${typeof value}.`);
}

class SqliteStatement implements DatabaseStatement {
  constructor(
    private readonly owner: SqliteDatabase,
    private readonly query: string,
    private readonly values: SqliteValue[] = [],
  ) {}

  bind(...values: unknown[]): DatabaseStatement {
    return new SqliteStatement(
      this.owner,
      this.query,
      values.map(sqliteValue),
    );
  }

  async all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return {
      results: this.owner.raw.prepare(this.query).all(...this.values) as T[],
      success: true,
    };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.owner.raw.prepare(this.query).get(...this.values);
    return (row as T | undefined) ?? null;
  }

  async run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return this.runNow() as DatabaseResult<T>;
  }

  runNow(): DatabaseResult {
    const result = this.owner.raw.prepare(this.query).run(...this.values);
    return {
      meta: { changes: Number(result.changes) },
      success: true,
    };
  }

  belongsTo(database: SqliteDatabase): boolean {
    return this.owner === database;
  }
}

class SqliteDatabase implements DatabaseLike {
  readonly raw: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.raw = new DatabaseSync(databasePath);
    this.raw.exec("PRAGMA foreign_keys = ON");
    this.raw.exec("PRAGMA journal_mode = WAL");
    this.raw.exec("PRAGMA busy_timeout = 5000");
  }

  prepare(query: string): DatabaseStatement {
    return new SqliteStatement(this, query);
  }

  async batch<T = Record<string, unknown>>(
    statements: DatabaseStatement[],
  ): Promise<DatabaseResult<T>[]> {
    const localStatements = statements.map((statement) => {
      if (
        !(statement instanceof SqliteStatement) ||
        !statement.belongsTo(this)
      ) {
        throw new Error("Próba wykonania zapytania z innej bazy danych.");
      }
      return statement;
    });

    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = localStatements.map(
        (statement) => statement.runNow() as DatabaseResult<T>,
      );
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

let database: DatabaseLike | null = null;
let openedPath = "";

export function getDatabase(): DatabaseLike {
  const configuredPath = process.env.DATABASE_PATH?.trim();
  const databasePath = configuredPath
    ? isAbsolute(configuredPath)
      ? configuredPath
      : join(/* turbopackIgnore: true */ process.cwd(), configuredPath)
    : join(process.cwd(), "data", "olx-radar.db");
  if (!database || openedPath !== databasePath) {
    database = new SqliteDatabase(databasePath);
    openedPath = databasePath;
  }
  return database;
}
