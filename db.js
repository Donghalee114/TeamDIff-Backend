const { Pool } = require('pg');
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        adminID TEXT NOT NULL,
        adminPassword TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        tournamentsID TEXT NOT NULL,
        name TEXT NOT NULL,
        shortName TEXT NOT NULL,
        logoUrl TEXT,
        winCount INTEGER DEFAULT 0,
        lossCount INTEGER DEFAULT 0,
        totalMatches INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournamentsID) REFERENCES tournaments(id) ON DELETE CASCADE
      );
    `);

    console.log('PostgreSQL 테이블 생성 완료');
  } catch (err) {
    console.error('PostgreSQL 테이블 생성 오류:', err);
  }
};

createTables();


module.exports = pool;