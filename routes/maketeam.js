const express = require('express');
const multer = require('multer');
const path = require('path');
const  pool  = require('../db');

const router = express.Router();

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


// ✅ 특정 팀 조회
router.get('/teams/:id', async (req, res) => {
  const teamId = req.params.id;

  try {
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


// ✅ 전체 팀 조회
router.get('/selectTeams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams');
    res.json(result.rows);
  } catch (err) {
    console.error('DB 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


// ✅ 로고 업로드 + 팀 생성
router.post('/upload', upload.single('logo'), async (req, res) => {
  const { name, shortName } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: '파일이 없습니다.' });
  }

  const logoUrl = `/uploads/${req.file.filename}`;
  const id = shortName.toLowerCase();

  // 유효성 검사
  if (name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: '팀 이름은 2자 이상 20자 이하이어야 합니다.' });
  }
  if (shortName.length < 2 || shortName.length > 3) {
    return res.status(400).json({ error: '팀 약어는 2자 이상 3자 이하이어야 합니다.' });
  }

  try {
    const check = await pool.query(
      'SELECT id FROM teams WHERE id = $1 OR name = $2 OR shortName = $3',
      [id, name, shortName.toUpperCase()]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: '이미 존재하는 팀입니다.' });
    }

    await pool.query(
      `INSERT INTO teams (id, name, shortName, logoUrl, winCount, lossCount, totalMatches)
       VALUES ($1, $2, $3, $4, 0, 0, 0)`,
      [id, name, shortName.toUpperCase(), logoUrl]
    );

    res.status(201).json({ message: '팀 생성 완료', logoUrl });
  } catch (err) {
    console.error('DB 삽입 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

module.exports = router;
