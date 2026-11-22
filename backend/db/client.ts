import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

export async function openDatabase(
  url = process.env.DATABASE_URL,
  migrationUrl = url === process.env.DATABASE_URL
    ? (process.env.DATABASE_URL_UNPOOLED ?? url)
    : url,
) {
  if (!url) throw new Error("Set DATABASE_URL to a Postgres connection URL.");
  const migrationClient = new Client({
    connectionString: migrationUrl,
    connectionTimeoutMillis: 5000,
  });
  try {
    await migrationClient.connect();
    // Serialize migration checks across app processes using the direct connection.
    await migrationClient.query("select pg_advisory_lock(839154, 1)");
    const {
      rows: [row],
    } = await migrationClient.query<{ schema: string }>(
      "select current_schema() as schema",
    );
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(
        new URL("./postgres-migrations", import.meta.url),
      ),
      migrationsSchema: row.schema,
    });
  } finally {
    await migrationClient.end();
  }

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (error) =>
    console.error("Idle Postgres connection error", error.message),
  );
  return { db: drizzle(pool), close: () => pool.end() };
}

export type Store = Awaited<ReturnType<typeof openDatabase>>["db"];
