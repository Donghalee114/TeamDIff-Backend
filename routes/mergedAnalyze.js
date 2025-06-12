const express = require('express');
const axios = require('axios');
const { extractMainAndBackupRoles } = require('../utils/extractRoles');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {
    const matchIdRes = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      {
        params: { start: 0, count: 8 , queue: 420},
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    const matchIds = matchIdRes.data;

    // 초기화
    let total = 0, wins = 0;
    const roleCounts = { TOP: 0, JUNGLE: 0, MID: 0, BOTTOM: 0, UTILITY: 0 };
    const typeMatches = { soloRank: 0, flexRank: 0, normalName: 0 };
    
    for (const matchId of matchIds) {
      const matchRes = await axios.get(
        `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        { headers: { 'X-Riot-Token': apiKey } ,
          params: {
            queue : 420
        }
      }
      );

      const matchData = matchRes.data;
      const queueId = matchData.info.queueId;
      const participant = matchData.info.participants.find(p => p.puuid === puuid);
      if (!participant) continue;

      let weight = 0;
      if (queueId === 420) {
        typeMatches.soloRank++;
        weight = 1.0;
      } else if (queueId === 440) {
        typeMatches.flexRank++;
        weight = 0.7;
      } else if ([430, 400].includes(queueId)) {
        typeMatches.normalName++;
        weight = 0.4;
      } else {
        continue; // 칼바람 등 무시
      }

      total += weight;
      if (participant.win) wins += weight;

      const role = participant.teamPosition;
      if (roleCounts.hasOwnProperty(role)) {
        roleCounts[role] += weight;
      }
    }

    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const scoreFromWinRate = Math.floor((winRate / 100) * 300);
    const { mainRole, backupRoles } = extractMainAndBackupRoles(roleCounts);

    res.json({
      puuid,
      totalWeightedGames: total.toFixed(1),
      winRate: winRate.toFixed(2),
      scoreFromWinRate,
      roleScores: roleCounts,
      mainRole,
      backupRoles: Array.isArray(backupRoles) ? backupRoles : [backupRoles],
      matchTypes: typeMatches
    });
  } catch (error) {
    console.error('🔥 분석 실패:', error.message);
    res.status(500).json({ error: '분석 실패', detail: error.message });
  }
});

module.exports = router;
