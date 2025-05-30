const express = require('express');
const path = require('path');
const pool = require('../db');
const multer = require('multer');
const router = express.Router();


const RIOT_API_KEY = process.env.RIOT_API_KEY;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

/* ========================
   🔹 토너먼트 관련
======================== */

// 생성
router.post('/tournaments', async (req, res) => {
  const { name, adminId, adminPassword } = req.body;
  const id = Math.random().toString(36).substring(2, 8);

  try {
    const check = await pool.query('SELECT id FROM tournaments WHERE id = $1', [id]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: '중복된 참가코드입니다.' });
    }

    await pool.query(
      'INSERT INTO tournaments (id, name, adminID, adminPassword) VALUES ($1, $2, $3, $4)',
      [id, name, adminId, adminPassword]
    );

    res.status(201).json({ id, name });
  } catch (err) {
    console.error('대회 생성 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 전체 조회
router.get('/tournaments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments');
    res.json(result.rows);
  } catch (err) {
    console.error('토너먼트 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 단일 조회
router.get('/tournaments/:id', async (req, res) => {
  console.log('[요청 받은 tournament ID]', req.params.id)
  const id = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: '토너먼트를 찾을 수 없습니다.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 해당 토너먼트의 팀 목록
router.get('/tournaments/:id/teams', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM teams WHERE tournamentsID = $1', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('팀 목록 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.post('/tournaments/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { adminId, adminPassword } = req.body;

  try {
    const result = await pool.query(
      `SELECT adminid, adminpassword FROM tournaments WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const { adminid, adminpassword } = result.rows[0];

    // ID 일치 확인
    if (adminid !== adminId) {
      return res.status(401).json({ error: 'ID mismatch' });
    }

    // 비밀번호 bcrypt 비교
    const isMatch = (adminPassword === adminpassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password mismatch' });
    }

    res.status(200).json({ message: '관리자 인증 성공' });

  } catch (err) {
    console.error('관리자 인증 실패:', err.message);
    res.status(500).json({ error: '서버 오류' });
  }
});
/* ========================
   🔹 팀 관련
======================== */

// 팀 생성
router.post('/teams', upload.single('logo'), async (req, res) => {
  const { name, shortName, tournamentsID } = req.body;
  if (!req.file) return res.status(400).json({ error: '로고 이미지가 없습니다.' });

  const logoUrl = `/uploads/${req.file.filename}`;
  const id = shortName.toLowerCase();

  if (name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: '팀 이름은 2~20자 사이여야 합니다.' });
  }
  if (shortName.length < 2 || shortName.length > 3) {
    return res.status(400).json({ error: '팀 약어는 2~3자 사이여야 합니다.' });
  }

  try {
    const check = await pool.query(
      'SELECT id FROM teams WHERE tournamentsID = $1 AND (id = $2 OR name = $3 OR shortName = $4)',
      [tournamentsID, id, name, shortName.toUpperCase()]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({ error: '해당 대회에 이미 존재하는 팀입니다.' });
    }

    await pool.query(
      `INSERT INTO teams (id, tournamentsID, name, shortName, logoUrl, winCount, lossCount, totalMatches)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 0)`,
      [id, tournamentsID, name, shortName.toUpperCase(), logoUrl]
    );

    res.status(201).json({ message: '팀 생성 완료', logoUrl });
  } catch (err) {
    console.error('팀 생성 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 팀 단일 조회
router.get('/teams/:id', async (req, res) => {
  const teamId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (result.rows.length === 0) return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('팀 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 전체 팀 조회 (관리용)
router.get('/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams');
    res.json(result.rows);
  } catch (err) {
    console.error('전체 팀 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

/* ========================
   🔹 팀 멤버 관련
======================== */
// 팀 멤버 추가 (등록)
router.post('/teams/:teamId/members', async (req, res) => {
  const { summonerName, puuid, role } = req.body;
  const { teamId } = req.params;
  
  if (!['LEADER', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  }

  try {
    await pool.query(
      'INSERT INTO team_members (teamId, summonerName, puuid, role) VALUES ($1, $2, $3, $4)',
      [teamId, summonerName, puuid, role]
    );
    res.status(201).json({ message: '팀 멤버 추가 완료' });
  } catch (err) {
    console.error('팀 멤버 추가 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 팀 멤버 조회
router.get('/teams/:teamId/members', async (req, res) => {
  const { teamId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM team_members WHERE teamId = $1', [teamId]);
    res.json(result.rows);
  } catch (err) {
    console.error('팀 멤버 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


/* ========================
   🔹 매치 관련
======================== */

// 매치 생성
router.post('/matches', async (req, res) => {
  const { matchId, teamA_id, teamB_id, winner_team } = req.body;

  try {
    await pool.query(
      `INSERT INTO matches (matchId, teamA_id, teamB_id, winner_team)
       VALUES ($1, $2, $3, $4)`,
      [matchId, teamA_id, teamB_id, winner_team]
    );
    res.status(201).json({ message: '매치 기록 완료' });
  } catch (err) {
    console.error('매치 생성 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 전체 매치 조회
router.get('/matches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches ORDER BY game_start_time DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('매치 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 특정 팀의 매치 조회
router.get('/teams/:teamId/matches', async (req, res) => {
  const { teamId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM matches 
       WHERE teamA_id = $1 OR teamB_id = $1 
       ORDER BY game_start_time DESC`,
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('팀 매치 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


/* ========================
   🔹 매치 참여자 기록
======================== */

// 매치 플레이어 기록 추가
router.post('/matches/:matchId/players', async (req, res) => {
  const { matchId } = req.params;
  const players = req.body.players; // 배열: [{ puuid, summonerName, team_id, kills, deaths, assists, win }, ...]

  try {
    for (const p of players) {
      await pool.query(
        `INSERT INTO match_players 
        (matchId, puuid, summonerName, team_id, kills, deaths, assists, win) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [matchId, p.puuid, p.summonerName, p.team_id, p.kills, p.deaths, p.assists, p.win]
      );
    }
    res.status(201).json({ message: '매치 플레이어 기록 완료' });
  } catch (err) {
    console.error('매치 플레이어 기록 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 특정 매치의 플레이어 조회
router.get('/matches/:matchId/players', async (req, res) => {
  const { matchId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM match_players WHERE matchId = $1 ORDER BY kills DESC',
      [matchId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('매치 플레이어 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


module.exports = router;
