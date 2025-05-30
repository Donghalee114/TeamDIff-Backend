const express = require('express');
const path = require('path');
const  pool  = require('../db');
const router = express.Router();
const multer = require('multer');


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


// 대회 생성
router.post('/makes', async (req, res) => {
  const { name, adminId, adminPassword } = req.body;
  const id = Math.random().toString(36).substring(2, 8);

  try {
    const check = await pool.query('SELECT id FROM tournaments WHERE id = $1', [id]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: '중복된 참가코드입니다. 다시 시도해주세요.' });
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


// 대회 단일 조회
router.get('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '해당 대회를 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

//대회 전체 조회
router.get('/allTournament' , async (req , res) => {
  
  try{
    const All = await pool.query('SELECT * FROM tournaments')
    if (All.rows.length === 0) {
      return res.status(404).json({error : '만들어진 대회가 없거나 찾을 수 없습니다.'})
    }
    res.json(All.rows)
  }catch (err){
    console.error('조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
})


// 특정 팀 조회
router.get('/:id/teams/', async (req, res) => {
  const teamId = req.params.id;

  try {
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('팀 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


// 전체 팀 조회
router.get('/selectTeams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams');
    res.json(result.rows);
  } catch (err) {
    console.error('팀 조회 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


// 팀 생성 + 이미지 업로드
router.post('/upload', upload.single('logo'), async (req, res) => {
  const { name, shortName } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: '파일이 없습니다.' });
  }

  const logoUrl = `/uploads/${req.file.filename}`;
  const id = shortName.toLowerCase();

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
    console.error('팀 생성 실패:', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});


module.exports = router;
