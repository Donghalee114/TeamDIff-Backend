const express = require('express');
const axios = require('axios');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:puuid/matches', async (req, res) => {
  const puuid = req.params.puuid;
  const start = req.query.start || 0;
  const count = req.query.count || 50;

  try {
    const response = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      {
        params: { start, count },
        headers: { 'X-Riot-Token': apiKey }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'API 호출 실패' });
  }
});

router.get('/detail/:matchId', async (req, res) => {
  const matchId = req.params.matchId;

  try {
    const response = await axios.get(
      `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      {
        headers: { 'X-Riot-Token': apiKey }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'API 호출 실패' });
  }
});

module.exports = router;
