require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db.js');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 6900;

// ✅ HTTP 서버 생성
const server = http.createServer(app);

// ✅ Socket.IO 서버 연결
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ✅ 방 상태 저장 객체
const rooms = {};

// ✅ 소켓 연결 처리
io.on('connection', (socket) => {
  console.log('🟢 사용자 연결됨');

  // ✅ 방 입장 처리
  socket.on('join-room', ({ roomId, role }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = role;

    if (!rooms[roomId]) {
      rooms[roomId] = { blueReady: false, redReady: false };
    }

    io.to(roomId).emit('room-status', rooms[roomId]);
    console.log(`[JOIN] ${role} joined ${roomId}`);
  });

  // ✅ 밴픽 방 입장
  socket.on('join-draft', ({ roomId }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    console.log(`[DRAFT] joined room: ${roomId}`);
  });

  // ✅ 준비 완료 처리
  socket.on('ready', () => {
    const { roomId, role } = socket.data;
    if (!roomId || !role) return;

    if (role === 'blue') rooms[roomId].blueReady = true;
    if (role === 'red') rooms[roomId].redReady = true;

    io.to(roomId).emit('room-status', rooms[roomId]);

    const { blueReady, redReady } = rooms[roomId];
    if (blueReady && redReady) {
      io.to(roomId).emit('start-draft');
    }
  });

  // ✅ 밴/픽 선택 처리
  socket.on('select-champion', ({ roomId, champion, team, type }) => {
    console.log(`[DRAFT] ${team} ${type}: ${champion} in room ${roomId}`);
    io.to(roomId).emit('update-draft', { champion, team, type });
  });

  // ✅ 연결 종료 시
  socket.on('disconnect', () => {
    console.log('🔴 사용자 연결 종료');
    const { roomId } = socket.data;
    if (roomId) {
      delete rooms[roomId]; // 선택: 방 정보 삭제
    }
  });
});

// ✅ DB 연결 테스트
const checkConnect = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL 연결 성공');
  } catch (err) {
    console.error('❌ PostgreSQL 연결 실패:', err);
  }
};

// ✅ 라우터 등록
const summonerRoutes = require('./routes/summoner');
const matchRoutes = require('./routes/match');
const mergedAnalyze = require('./routes/mergedAnalyze');
const tournament = require('./routes/tournament');
const team = require('./routes/team');
const draftRoom = require('./routes/draftRoom');

app.get('/', (req, res) => {
  res.send('롤 팀짜기 백엔드 작동 중');
});

app.use('/summoner', summonerRoutes);
app.use('/match', matchRoutes);
app.use('/merged-analyze', mergedAnalyze);
app.use('/tournament', tournament);
app.use('/teams', team);
app.use('/room', draftRoom);

// ✅ 서버 실행
server.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});

checkConnect();
