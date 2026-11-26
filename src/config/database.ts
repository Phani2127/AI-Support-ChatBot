
import pg from "pg";

const { Pool } = pg;

// Shared by the app pool and by libraries that manage their own connections (LangChain).
export function getDatabaseConfig() {
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "support_db"
  };
}

export const pool = new Pool(getDatabaseConfig());

pool.on("error", (error) => {
  console.error("Unexpected database error:", error);
});

export async function connectDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log("Database connected successfully");
  } finally {
    client.release();
  }
}
