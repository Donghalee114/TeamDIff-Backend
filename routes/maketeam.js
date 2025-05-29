const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');

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


router.get('/teams/:id', (req, res) => {
  const teamId = req.params.id;

  db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, row) => {
    if (err) {
      console.error('DB 조회 실패:', err.message);
      return res.status(500).json({ error: 'DB 조회 실패' });
    }
    if (!row) {
      return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    }
    res.json(row);
  });
});



//팀 조회를 위한 라우트
router.get('/selectTeams', (req, res) => {
  db.all('SELECT * FROM teams', [], (err, rows) => {
    if (err) {
      console.error('DB 조회 실패:', err.message);
      return res.status(500).json({ error: 'DB 조회 실패' });
    }
    res.json(rows);
  });
});



//로고 이미지 업로드 및 팀 생성
router.post('/upload', upload.single('logo'), (req, res) => {
  console.log('요청 수신됨:', req.body, req.file); // 🔍 요청 확인
  const { name, shortName } = req.body;

  if (!req.file) {
    console.error('파일이 없습니다.');
    return res.status(400).json({ error: '파일이 없습니다.' });
  }

  const logoUrl = `/uploads/${req.file.filename}`;
  const id = shortName.toLowerCase();

  if (name.length < 2 || name.length > 20) {
    console.error('팀 이름 길이 오류:', name);
    return res.status(400).json({ error: '팀 이름은 2자 이상 20자 이하이어야 합니다.' });
  }
  if (shortName.length < 2 || shortName.length > 3) {
    console.error('팀 약어 길이 오류:', shortName);
    return res.status(400).json({ error: '팀 약어는 2자 이상 3자 이하이어야 합니다.' });
  }

  db.get('SELECT id FROM teams WHERE id = ? OR name = ? OR shortName = ?', [id, name, shortName.toUpperCase()], (err, row) => {
    if (err) {
      console.error('DB 조회 실패:', err.message);
      return res.status(500).json({ error: 'DB 조회 실패' });
    }

    if (row) {
      return res.status(400).json({ error: '이미 존재하는 팀입니다.' });
    }

    // 중복이 없을 경우 삽입 진행
    db.run(
      `INSERT INTO teams (id, name, shortName, logoUrl, winCount, lossCount, totalMatches)
       VALUES (?, ?, ?, ?, 0, 0, 0)`,
      [id, name, shortName.toUpperCase(), logoUrl],
      function (err) {
        if (err) {
          console.error('DB 삽입 실패:', err.message);
          return res.status(500).json({ error: 'DB 삽입 실패' });
        }
        res.status(201).json({ message: '팀 생성 완료', logoUrl });
      }
    );
  });
});

module.exports = router;
