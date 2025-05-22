const express = require('express');
const axios = require('axios');
const { extractMainAndBackupRoles } = require('../utils/extractRoles');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {
    // 1. 매치 ID 가져오기 (10개 요청)
    const matchIdRes = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      {
        params: { start: 0, count: 10 },
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    const matchIds = matchIdRes.data;

    // 2. 분석용 초기 변수 선언
    let total = 0;
    let wins = 0;
    let analyzed = 0;
    const roleCounts = { TOP: 0, JUNGLE: 0, MID: 0, BOTTOM: 0, UTILITY: 0 };

    for (const matchId of matchIds) {
      const matchRes = await axios.get(
        `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: { 'X-Riot-Token': apiKey }
        }
      );

      const matchData = matchRes.data;
      const queueId = matchData.info.queueId;

      // 솔로 랭크(420)만 분석
      if (queueId !== 420) continue;

      const participant = matchData.info.participants.find(p => p.puuid === puuid);
      if (!participant) continue;

      // 승률 분석
      total++;
      if (participant.win) wins++;

      // 라인 분석
      const role = participant.teamPosition;
      if (roleCounts.hasOwnProperty(role)) {
        roleCounts[role]++;
        analyzed++;
      }

      if (analyzed >= 20) break; // 과도한 분석 방지
    }

    // 결과 계산
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const scoreFromWinRate = Math.floor((winRate / 100) * 300);
    const { mainRole, backupRoles } = extractMainAndBackupRoles(roleCounts);

    // 응답 반환
    res.json({
      puuid,
      totalRankGames: total,
      wins,
      winRate: winRate.toFixed(2),
      scoreFromWinRate,
      roleScores: roleCounts,
      mainRole,
      backupRoles: Array.isArray(backupRoles) ? backupRoles : [backupRoles]
    });
  } catch (error) {
    console.error('통합 분석 실패:', error.message);
    res.status(500).json({ error: '통합 분석 중 오류 발생' });
  }
});

module.exports = router;
