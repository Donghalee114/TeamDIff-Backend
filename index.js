// backend/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const pool    = require('./db.js');

const summonerRoutes = require('./routes/summoner');
const matchRoutes = require('./routes/match');
const teamRouter = require('./routes/team');
const mergedAnalyze = require('./routes/mergedAnalyze');
const tournament = require('./routes/tournament');
const team = require('./routes/team');
const draftRoom = require('./routes/draftRoom');

const PORT = process.env.PORT || 6900;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });



require('./socket/draft')(io);

/* ───────── 기타 라우터 (필요 없으면 제거) ───────── */
app.get('/', (_, res) => res.send('LOL TeamDiff backend OK'));
app.use('/room', require('./routes/draftRoom'));
app.use('/summoner', summonerRoutes);
app.use('/match', matchRoutes);
app.use('/merged-analyze', mergedAnalyze);
app.use('/teams', teamRouter);
app.use('/tournament', tournament);
app.use('/teams', team);
app.use('/room', draftRoom);


app.get('/ping' , (req, res) => {
  res.status(200).json({ message: 'pong' });
});

(async () => {
  try { await pool.query('SELECT NOW()'); console.log('✅ PostgreSQL 연결'); }
  catch (e) { console.error('❌ PostgreSQL 실패', e); }
})();
server.listen(PORT, () => console.log(`앱 실행 http://localhost:${PORT}`));
