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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        teamId TEXT,
        tournamentsID TEXT NOT NULL,
        summonerName TEXT NOT NULL,
        leader_puuid TEXT,
        member_puuid TEXT ,
        PRIMARY KEY (teamId, summonerName),
        FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        matchId TEXT PRIMARY KEY,
        teamA_id TEXT,
        teamB_id TEXT,
        winner_team TEXT,
        game_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teamA_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (teamB_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (winner_team) REFERENCES teams(id) ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS match_players (
        id SERIAL PRIMARY KEY,
        matchId TEXT NOT NULL,
        puuid TEXT NOT NULL,
        summonerName TEXT,
        team_id TEXT,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        win BOOLEAN,
        FOREIGN KEY (matchId) REFERENCES matches(matchId) ON DELETE CASCADE
      );
    `);


    console.log('PostgreSQL 테이블 생성 완료');
  } catch (err) {
    console.error('PostgreSQL 테이블 생성 오류:', err);
  }
};

const checkTest = async () => {
  try {
    await pool.query(
      `INSERT INTO tournaments (id, name, adminID, adminPassword)
       VALUES ($1, $2, $3, $4)`,
      ['23d31d', 'latest', 'latest', 'latest']
    );
    console.log('✅ 삽입 완료');
  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
};

const deleteTournament = async () => {
  try{
    await pool.query(
      `DELETE FROM tournaments *`
    )
    console.log("삭제완료")
  } catch(err){
    console.err("오류" , err.message)
  } 
}

createTables()

module.exports = pool;
