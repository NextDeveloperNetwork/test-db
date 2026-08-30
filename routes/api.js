const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, prisma, connectionString } = require('../db/pool');

const router = express.Router();

// Auto-initialize schema & tables
async function ensureSchema() {
  try {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'User',
        status VARCHAR(20) DEFAULT 'Active',
        bio TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Planning',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTablesQuery);
    console.log('✅ PostgreSQL & Prisma Schema verified.');
  } catch (err) {
    console.warn('⚠️ Could not auto-initialize schema:', err.message);
  }
}

ensureSchema();

// Health Check
router.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  try {
    const result = await pool.query(`
      SELECT 
        current_database() AS database,
        current_user AS user,
        version() AS version,
        NOW() AS server_time
    `);
    const latency = Date.now() - startTime;
    res.json({
      status: 'connected',
      latencyMs: latency,
      database: result.rows[0].database,
      user: result.rows[0].user,
      version: result.rows[0].version,
      serverTime: result.rows[0].server_time,
      connectionString: connectionString.replace(/:[^:@]+@/, ':****@')
    });
  } catch (err) {
    res.status(500).json({
      status: 'disconnected',
      error: err.message,
      connectionString: connectionString.replace(/:[^:@]+@/, ':****@')
    });
  }
});

// User Registration Route
router.post('/api/register', async (req, res) => {
  const { full_name, email, username, password, role, bio } = req.body;

  if (!full_name || !email || !username) {
    return res.status(400).json({ error: 'Full Name, Email, and Username are required.' });
  }

  try {
    let passwordHash = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const newUser = await prisma.user.create({
      data: {
        fullName: full_name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim(),
        passwordHash,
        role: role || 'User',
        status: 'Active',
        bio: bio || ''
      }
    });

    // Auto-login user after registration
    req.session.userId = newUser.id;
    req.session.user = {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role
    };

    res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: newUser.id,
        full_name: newUser.fullName,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status,
        bio: newUser.bio,
        created_at: newUser.createdAt
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    if (err.code === 'P2002') {
      const target = err.meta?.target || [];
      if (target.includes('email') || String(err.message).includes('email')) {
        return res.status(409).json({ error: 'Email address is already registered.' });
      }
      if (target.includes('username') || String(err.message).includes('username')) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
      return res.status(409).json({ error: 'A user with these details already exists.' });
    }
    res.status(500).json({ error: err.message || 'Database error during registration.' });
  }
});

// List all tables in public schema
router.get('/api/tables', async (req, res) => {
  try {
    const tablesQuery = `
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name ASC;
    `;
    const tablesResult = await pool.query(tablesQuery);
    
    const tablesWithCounts = await Promise.all(
      tablesResult.rows.map(async (row) => {
        try {
          const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
          return {
            table_name: row.table_name,
            column_count: parseInt(row.column_count, 10),
            row_count: parseInt(countRes.rows[0].count, 10)
          };
        } catch (e) {
          return {
            table_name: row.table_name,
            column_count: parseInt(row.column_count, 10),
            row_count: 0
          };
        }
      })
    );

    res.json({ tables: tablesWithCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get table schema and rows
router.get('/api/tables/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const search = req.query.search || '';
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const offset = (page - 1) * limit;

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Invalid table name format.' });
  }

  try {
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position ASC;
    `;
    const columnsResult = await pool.query(columnsQuery, [tableName]);
    const columns = columnsResult.rows;

    if (columns.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' not found or has no columns.` });
    }

    const pkQuery = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
    `;
    const pkResult = await pool.query(pkQuery, [tableName]);
    const primaryKeys = pkResult.rows.map(r => r.column_name);

    let whereClause = '';
    const queryParams = [];
    if (search.trim()) {
      const textColumns = columns
        .filter(c => ['character varying', 'text', 'varchar', 'char'].includes(c.data_type.toLowerCase()))
        .map(c => `"${c.column_name}"::text ILIKE $1`);
      
      if (textColumns.length > 0) {
        whereClause = `WHERE ${textColumns.join(' OR ')}`;
        queryParams.push(`%${search.trim()}%`);
      }
    }

    const totalCountQuery = `SELECT COUNT(*) FROM "${tableName}" ${whereClause};`;
    const countRes = await pool.query(totalCountQuery, queryParams);
    const totalRows = parseInt(countRes.rows[0].count, 10);

    const dataParams = [...queryParams];
    dataParams.push(limit);
    dataParams.push(offset);
    const limitOffsetIndex = queryParams.length;

    const orderByCol = primaryKeys[0] || columns[0].column_name;
    const rowsQuery = `
      SELECT * FROM "${tableName}" 
      ${whereClause}
      ORDER BY "${orderByCol}" DESC
      LIMIT $${limitOffsetIndex + 1} OFFSET $${limitOffsetIndex + 2};
    `;
    
    const rowsResult = await pool.query(rowsQuery, dataParams);

    res.json({
      tableName,
      columns,
      primaryKeys,
      rows: rowsResult.rows,
      pagination: {
        totalRows,
        page,
        limit,
        totalPages: Math.ceil(totalRows / limit) || 1
      }
    });
  } catch (err) {
    console.error(`Error fetching table ${tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Execute SQL query endpoint
router.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql || !sql.trim()) {
    return res.status(400).json({ error: 'SQL statement is required.' });
  }

  const startTime = Date.now();
  try {
    const result = await pool.query(sql);
    const executionTimeMs = Date.now() - startTime;

    res.json({
      command: result.command,
      rowCount: result.rowCount,
      fields: result.fields ? result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) : [],
      rows: result.rows || [],
      executionTimeMs
    });
  } catch (err) {
    res.status(400).json({
      error: err.message,
      executionTimeMs: Date.now() - startTime
    });
  }
});

// Manual database schema sync trigger
router.post('/api/init-db', async (req, res) => {
  try {
    await ensureSchema();
    res.json({ message: 'Database schema successfully initialized.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
