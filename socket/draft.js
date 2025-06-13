const PER_TURN_TIME = 30_000;
const CHAMP_URL     = 'https://ddragon.leagueoflegends.com/cdn/14.12.1/data/ko_KR/champion.json';

module.exports = function initDraftSocket(io) {
  const rooms = {};
  let championIds = [];

  fetch(CHAMP_URL)
    .then(r => r.json())
    .then(d => {
      championIds = Object.values(d.data).map(c => c.id);
      console.log('✅ 챔피언 캐시 완료');
    })
    .catch(console.error);

  io.on('connection', socket => {
    console.log('🔌 Socket connected:', socket.id);

    socket.on('join-room', payload => handleJoin(socket, payload));
    socket.on('ready',        () => handleReady(socket));
    socket.on('select-champion', payload => handleSelect(socket, payload));
    socket.on('match-result', payload => handleMatchResult(socket, payload));
    socket.on('side-chosen',  payload => handleSideChosen(socket, payload));
    socket.on('disconnect', () => {
      const { roomId, role } = socket.data || {};
      if (roomId && role) {
        socket.to(roomId).emit('user-left', { role });    // 상대에게 알림
        console.log(`[알림] ${role} 유저 방 ${roomId}에서 나감`);
      }
    });
    socket.on('user-leave', ({ roomId, role }) => {
      socket.to(roomId).emit('user-left', { role });      // 수동 leave 도 동일 처리
    });
  });

  /* ---------- JOIN ---------- */
  function handleJoin(socket, { roomId, role, blueTeam, redTeam, bo, mode, hostKey  }) {
    socket.join(roomId);
    socket.data = { roomId, role };

    if (!rooms[roomId]) {
      rooms[roomId] = {
        /* roomId 반드시 포함 ⬇ */
        roomId,
        hostKey,  
        blueTeam,
        redTeam,
        bo,
        mode,
        blueReady:false,
        redReady:false,
        sideMap: { blue: blueTeam, red: redTeam },
        series: {
          teamWins:{ [blueTeam]:0, [redTeam]:0 },
          currentGame:1,
          resultPosted:false,
          over:false
        }
      };
    }
    io.to(roomId).emit('room-status', rooms[roomId]);
  }

  /* ---------- READY ---------- */
  function handleReady(socket) {
    const { roomId, role } = socket.data;
    const room = rooms[roomId];
    if (!room) return;

    if (role === 'blue') room.blueReady = true;
    if (role === 'red')  room.redReady  = true;

    io.to(roomId).emit('room-status', room);
    if (room.blueReady && room.redReady) startDraft(roomId);
  }

  /* ---------- DRAFT START ---------- */
  function startDraft(roomId) {
    const room = rooms[roomId];
    room.order      = getBanPickOrder();
    room.turnIndex  = 0;
    room.history    = [];
    room.timer      = Date.now() + PER_TURN_TIME;
    room.series.resultPosted = false;

    io.to(roomId).emit('start-draft', {
      order: room.order,
      currentGame: room.series.currentGame,
      hostKey: room.hostKey 
    });
    tick(roomId);
  }

  /* ---------- TIMER ---------- */
  function tick(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const remain = room.timer - Date.now();
    io.to(roomId).emit('timer', Math.max(0, Math.ceil(remain / 1000)));

    if (remain <= 0) return handleTimeout(roomId);
    if (room.turnIndex < room.order.length) setTimeout(() => tick(roomId), 1000);
  }

  /* ---------- TIMEOUT ---------- */
  function handleTimeout(roomId) {
    const room = rooms[roomId];
    const cur  = room.order[room.turnIndex];

    const champ =
      cur.type === 'ban'
        ? null
        : randomChampion(room.history.map(h => h.champion));

    applyPick(roomId, champ, cur.team, cur.type);
    nextTurn(roomId);
  }

  /* ---------- MANUAL SELECT ---------- */
  function handleSelect(socket, { roomId, champion, team, type }) {
    const room = rooms[roomId];
    const cur  = room?.order[room?.turnIndex];
    if (!cur || cur.team !== team || cur.type !== type) return;

    applyPick(roomId, champion, team, type);
    nextTurn(roomId);
  }

  /* ---------- APPLY PICK/BAN ---------- */
  function applyPick(roomId, champion, team, type) {
    const room = rooms[roomId];
    room.history.push({ champion, team, type });
    io.to(roomId).emit('update-draft', { champion, team, type });
  }

  function nextTurn(roomId) {
    const room = rooms[roomId];
    room.turnIndex += 1;

    if (room.turnIndex >= room.order.length) {
      io.to(roomId).emit('draft-finished', room.history);
      return;
    }
    room.timer = Date.now() + PER_TURN_TIME;
    tick(roomId);
  }

  /* ---------- MATCH RESULT (host only) ---------- */
  function handleMatchResult(socket, { roomId, winner , hostKey }) {
    const room = rooms[roomId];
    if (!room || hostKey !== room.hostKey || room.series.resultPosted) return;

    room.series.resultPosted = true;
    room.series.teamWins[winner] += 1;

    const need = Math.ceil(room.bo / 2);
    if (room.series.teamWins[winner] >= need) {
      room.series.over = true;
      io.to(roomId).emit('series-finished', {
        blueWins: room.series.teamWins[room.blueTeam],
        redWins : room.series.teamWins[room.redTeam]
      });
      return;
    }

    const loserTeam = winner === room.blueTeam ? room.redTeam : room.blueTeam;
    const loserSide = room.sideMap.blue === loserTeam ? 'blue' : 'red';

    room.blueReady = room.redReady = false; // 다음 게임 준비
    io.to(roomId).emit('choose-side', {
      loser: loserSide,
      nextGame: room.series.currentGame + 1
    });
  }

  /* ---------- SIDE CHOSEN (host only) ---------- */
  function handleSideChosen(socket, { roomId, loser, side }) {
    const room = rooms[roomId];
    if (!room || socket.id !== room.hostId) return;

    // 사이드 스왑
    if (side !== loser) {
      [room.blueTeam, room.redTeam] = [room.redTeam, room.blueTeam];
      room.sideMap = { blue: room.blueTeam, red: room.redTeam };
    }

    room.series.currentGame += 1;
    io.to(roomId).emit('next-draft', {
      currentGame: room.series.currentGame,
      sideMap: room.sideMap
    });
  }

  /* ---------- UTIL ---------- */
  function randomChampion(used) {
    const remain = championIds.filter(id => !used.includes(id));
    return remain[Math.floor(Math.random() * remain.length)];
  }

  function getBanPickOrder() {
    return [
      { type:'ban',team:'blue'},{ type:'ban',team:'red'},
      { type:'ban',team:'blue'},{ type:'ban',team:'red'},
      { type:'ban',team:'blue'},{ type:'ban',team:'red'},
      { type:'pick',team:'blue'},{ type:'pick',team:'red'},
      { type:'pick',team:'red' },{ type:'pick',team:'blue'},
      { type:'pick',team:'blue'},{ type:'pick',team:'red'},
      { type:'ban',team:'red' },{ type:'ban',team:'blue'},
      { type:'ban',team:'red' },{ type:'ban',team:'blue'},
      { type:'pick',team:'red' },{ type:'pick',team:'blue'},
      { type:'pick',team:'blue'},{ type:'pick',team:'red'}
    ];
  }
};
