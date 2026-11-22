import { randomUUID } from "node:crypto";
import { Client } from "pg";

export async function createTestDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "Set TEST_DATABASE_URL to a direct Postgres test database URL.",
    );
  }

  const schema = `stockroom_test_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(testUrl);
  const options = url.searchParams.get("options");
  url.searchParams.set(
    "options",
    [options, `-c search_path=${schema}`].filter(Boolean).join(" "),
  );

  async function withAdmin(query: string) {
    const admin = new Client({ connectionString: testUrl });
    try {
      await admin.connect();
      await admin.query(query);
    } finally {
      await admin.end();
    }
  }

  await withAdmin(`create schema "${schema}"`);
  return {
    url: url.toString(),
    drop: () => withAdmin(`drop schema "${schema}" cascade`),
  };
}
