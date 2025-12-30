import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

/**
 * Direct Postgres connection using the 'pg' library.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Executes a SQL query against the database using a direct connection.
 */
export async function executeQuery(sql: string): Promise<any[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(sql);
    return res.rows;
  } catch (error: any) {
    console.error(`Database error executing query: ${sql}`, error);
    throw new Error(`Database error: ${error.message}`);
  } finally {
    client.release();
  }
}
