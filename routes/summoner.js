const express = require('express');
const axios = require('axios');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:name', async (req, res) => {
  const summonerName = req.params.name;
  const summonerTag = req.query.tag || 'KR1';

  try {
    const response = await axios.get(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${summonerTag}`,
      {
        headers: {
          'X-Riot-Token': apiKey
        }
      }
    );
    res.json({
      puuid: response.data.puuid,
      summonerId: response.data.id,
      name: response.data.gameName
    });
  } catch (error) {
    res.status(500).json({ error: 'API 호출 실패' });
  }
});

router.get('/league/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {
    const summonerRes = await axios.get(
      `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      {
        headers: { 'X-Riot-Token': apiKey }
      }
    );
    const summonerId = summonerRes.data.id;

    const leagueRes = await axios.get(
      `https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    res.json(leagueRes.data);
  } catch (error) {
    res.status(500).json({ error: 'API 호출 실패' });
  }
});

module.exports = router;
