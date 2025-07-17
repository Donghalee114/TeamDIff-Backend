const express = require('express');
const axios = require('axios');
const router = express.Router();

const apiKey = process.env.RIOT_API_KEY;

router.get('/:name', async (req, res) => {
  const summonerName = req.params.name;
  const summonerTag = req.query.tag || 'KR1';

  try {
    // 첫 번째 API: Riot ID → PUUID
    const response = await axios.get(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${summonerTag}`,
      {
        headers: {
          'X-Riot-Token': apiKey
        }
      }
    );

    const puuid = response.data.puuid;

    // 두 번째 API: PUUID → Summoner info
    const response2 = await axios.get(
      `https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      {
        headers: {
          'X-Riot-Token': apiKey
        }
      }
    );

    // 하나의 JSON 객체로 응답
    res.json({
      puuid: response.data.puuid,
      summonerId: response2.data.id,
      tagLine: response.data.tagLine,
      name: response.data.gameName,
      profileIconId: response2.data.profileIconId,
      summonerLevel: response2.data.summonerLevel
    });

  } catch (error) {
    console.error('API 호출 실패:', error);
    res.status(500).json({ error: `API 호출 실패: ${error.message}` });
  }
});


router.get('/league/:puuid', async (req, res) => {
  const puuid = req.params.puuid;

  try {

    const leagueRes = await axios.get(
      `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
      {
        headers: { 'X-Riot-Token': apiKey }
      }
    );

    res.json(leagueRes.data);
  } catch (error) {
  console.error('🔥 분석 실패:', error.message);
  if (error.response) {
    console.error('🔁 응답 상태:', error.response.status);
    console.error('📄 응답 내용:', error.response.data);
  } else {
    console.error('🧨 기타 오류:', error);
  }
  res.status(500).json({ error: '분석 실패', detail: error.message });
}
});



module.exports = router;
