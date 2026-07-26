import pg from "pg";

const { Pool } = pg;

export const postgresPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

postgresPool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

export async function connectPostgres() {
  const client = await postgresPool.connect();

  try {
    const result = await client.query(
      "SELECT current_database() AS database, NOW() AS connected_at"
    );

    console.log(
      `PostgreSQL connected: ${result.rows[0].database}`
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function checkPostgresConnection() {
  const result = await postgresPool.query(
    "SELECT 1 AS connected"
  );

  return result.rows[0].connected === 1;
}