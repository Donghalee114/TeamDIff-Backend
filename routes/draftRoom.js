// ✅ draftRoom.js - 메모리 기반 모의 벤픽 방 저장소 (전체 코드)

const express = require('express');
const router = express.Router();

// 모든 방을 저장하는 객체
const draftRooms = {}; // key: roomId, value: 방 정보
const ROOM_TTL = 1000 * 60 * 60; // 1시간 유지

// ✅ 방 생성 함수
function createRoom(roomId, data) {
  draftRooms[roomId] = {
    ...data,
    createdAt: Date.now()
  };
  scheduleRoomDeletion(roomId);
  console.log(`✅ 방 생성됨: ${roomId}`);
}

// ✅ 방 조회
function getRoom(roomId) {
  return draftRooms[roomId];
}

// ✅ 방 삭제
function deleteRoom(roomId) {
  delete draftRooms[roomId];
  console.log(`🗑️ 방 삭제됨: ${roomId}`);
}

// ✅ 자동 삭제 예약
function scheduleRoomDeletion(roomId) {
  setTimeout(() => {
    if (draftRooms[roomId]) {
      deleteRoom(roomId);
    }
  }, ROOM_TTL);
}

// ✅ API: /room/:roomId → 방 정보 조회
router.get('/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  res.json({
    ...room,
    picked: room.picked || [],
    turnIdx: room.turnIdx || 0,
    series: room.series || { blueWins: 0, redWins: 0, currentGame: 1 },
  });
});

router.post('/', (req, res) => {
  const { roomId, blueTeam, redTeam, bo, mode , hostKey } = req.body;
  if (!roomId || !blueTeam || !redTeam || !bo || !mode) {
    return res.status(400).json({ message: '필수 값 누락' });
  }

  if (getRoom(roomId)) {
    return res.status(409).json({ message: '이미 존재하는 방입니다' });
  }

  createRoom(roomId, {
    blueTeam,
    redTeam,
    bo,
    mode,
    blueReady: false,
    redReady: false,
    draftStarted: false,
    hostId: null
  });

  res.status(201).json({ message: '방 생성 완료' });
});

// ✅ 외부에서 사용 가능하도록 export
module.exports = router

