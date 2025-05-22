const express = require('express');
const axios = require('axios');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {
    const matchIdRes = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      {
        params: { start: 0, count: 3 },
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    const matchIds = matchIdRes.data;

    let total = 0;
    let wins = 0;

    for (const matchId of matchIds) {
      const matchRes = await axios.get(
        `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: { 'X-Riot-Token': apiKey }
        }
      );

      const matchData = matchRes.data;
      const queueId = matchData.info.queueId;

      if (queueId !== 420) continue;

      const participant = matchData.info.participants.find(p => p.puuid === puuid);
      if (!participant) continue;

      total++;
      if (participant.win) wins++;
    }

    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const score = Math.floor((winRate / 100) * 300);

    res.json({
      puuid,
      totalRankGames: total,
      wins,
      winRate: winRate.toFixed(2),
      scoreFromWinRate: score
    });
  } catch (error) {
    console.error('분석 API 오류:', error.message);
    res.status(500).json({ error: '분석 실패..' });
  }
});

module.exports = router;
