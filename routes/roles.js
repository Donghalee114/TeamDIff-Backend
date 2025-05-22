const express = require('express');
const axios = require('axios');
const { extractMainAndBackupRoles } = require('../utils/extractRoles');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {
    const matchRes = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      {
        params: { start: 0, count: 3 },
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    const matchIds = matchRes.data;
    const roleCounts = { TOP: 0, JUNGLE: 0, MIDDEL: 0, BOTTOM: 0, UTILITY: 0 };
    let analyzed = 0;

    for (const matchId of matchIds) {
      const matchData = await axios.get(
        `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        { headers: { 'X-Riot-Token': apiKey } }
      );

      const participant = matchData.data.info.participants.find(p => p.puuid === puuid);
      const queueId = matchData.data.info.queueId;

      if (!participant || queueId !== 420) continue;

      const role = participant.teamPosition;
      if (roleCounts.hasOwnProperty(role)) {
        roleCounts[role]++;
        analyzed++;
      }

      if (analyzed >= 20) break;
    }

    const { mainRole, backupRoles } = extractMainAndBackupRoles(roleCounts);

    res.json({
      puuid,
      roleScores: roleCounts,
      mainRole,
      backupRoles: Array.isArray(backupRoles) ? backupRoles : [backupRoles]
    });
  } catch (err) {
    res.status(500).json({ error: '라인 분석 실패' });
  }
});

module.exports = router;
