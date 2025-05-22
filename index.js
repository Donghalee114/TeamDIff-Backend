require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6900;

// 라우터 불러오기
const summonerRoutes = require('./routes/summoner');
const matchRoutes = require('./routes/match');
const teamRouter = require('./routes/team');
const mergedAnalyze = require('./routes/mergedAnalyze');


// const teamRoutes = require('./routes/team'); ← 나중에 추가

// 기본 라우트
app.get('/', (req, res) => {
  res.send('롤 팀짜기 백엔드 작동 중');
});

// API 라우트 등록
app.use('/summoner', summonerRoutes);
app.use('/match', matchRoutes);
app.use('/merged-analyze', mergedAnalyze);
app.use('/teams', teamRouter);
// app.use('/team', teamRoutes); ← 나중에 추가

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
