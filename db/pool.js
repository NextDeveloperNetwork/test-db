// Shared PostgreSQL Pool & Prisma Client Export
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://myapp:arial123@192.168.1.40:5432/mydata';

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL Pool Error:', err.message);
});

const prisma = new PrismaClient();

module.exports = {
  pool,
  prisma,
  connectionString
};
