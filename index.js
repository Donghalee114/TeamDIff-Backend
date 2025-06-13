// backend/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');
const pool    = require('./db.js');

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

(async () => {
  try { await pool.query('SELECT NOW()'); console.log('✅ PostgreSQL 연결'); }
  catch (e) { console.error('❌ PostgreSQL 실패', e); }
})();
server.listen(PORT, () => console.log(`🚀  http://localhost:${PORT}`));
