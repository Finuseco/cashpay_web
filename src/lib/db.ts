
import { Pool } from 'pg';

const sslConfig = process.env.DB_SSL_CA
  ? {
      ssl: {
        ca: process.env.DB_SSL_CA,
        rejectUnauthorized: true,
      },
    }
  : undefined;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  max: 10, // Augmenté à 10 pour supporter le polling et les appels longs
  idleTimeoutMillis: 10000, 
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ...sslConfig,
});

const query = (sql: string, params?: any[]) => {
  return pool.query(sql, params);
};

export const db = {
  query,
  getConnection: () => pool.connect(),
};
