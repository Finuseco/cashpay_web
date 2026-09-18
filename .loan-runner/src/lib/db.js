"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const sslConfig = process.env.DB_SSL_CA
    ? {
        ssl: {
            ca: process.env.DB_SSL_CA,
            rejectUnauthorized: true,
        },
    }
    : undefined;
const pool = new pg_1.Pool({
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
const query = (sql, params) => {
    return pool.query(sql, params);
};
exports.db = {
    query,
    getConnection: () => pool.connect(),
};
