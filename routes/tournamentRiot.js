// routes/analyzeMatch.js
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const router = express.Router();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const MATCH_LIMIT = 10; // 각 팀장당 최근 매치 수 제한

// 플레이어 점수 계산 함수
function calculateScore(p) {
  return (p.kills * 2) + p.assists - (p.deaths * 1.5) + (p.win ? 10 : 0);
}

// Riot match fetch
async function getRecentMatches(puuid) {
  const res = await axios.get(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
    params: { start: 0, count: MATCH_LIMIT },
    headers: { 'X-Riot-Token': RIOT_API_KEY }
  });
  return res.data;
}

// Match detail
async function getMatchDetails(matchId) {
  const res = await axios.get(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
    headers: { 'X-Riot-Token': RIOT_API_KEY }
  });
  return res.data;
}

// 분석 API
router.post('/analyze-match', async (req, res) => {
  const { teamA_leader_puuid, teamB_leader_puuid, teamA_id, teamB_id } = req.body;

  try {
    const [matchesA, matchesB] = await Promise.all([
      getRecentMatches(teamA_leader_puuid),
      getRecentMatches(teamB_leader_puuid)
    ]);

    const commonMatch = matchesA.find(id => matchesB.includes(id));
    if (!commonMatch) return res.status(404).json({ error: '공통 커스텀 매치를 찾을 수 없습니다.' });

    const matchData = await getMatchDetails(commonMatch);
    const info = matchData.info;

    // 검증: 커스텀 게임인지 확인
    if (info.gameMode !== 'CUSTOM') return res.status(400).json({ error: '커스텀 게임이 아닙니다.' });

    // 팀 구분 및 승패 판단
    const players = info.participants;
    const teamWin = players.find(p => p.teamId === 100)?.win ? teamA_id : teamB_id;

    // matches 테이블 저장
    await pool.query(`
      INSERT INTO matches (matchId, teamA_id, teamB_id, winner_team)
      VALUES ($1, $2, $3, $4)
    `, [commonMatch, teamA_id, teamB_id, teamWin]);

    // match_players 저장
    for (const p of players) {
      const score = calculateScore(p);
      await pool.query(`
        INSERT INTO match_players
        (matchId, puuid, summonerName, team_id, kills, deaths, assists, win)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        commonMatch,
        p.puuid,
        p.summonerName,
        p.teamId === 100 ? teamA_id : teamB_id,
        p.kills,
        p.deaths,
        p.assists,
        p.win
      ]);
    }

    res.status(201).json({ message: '매치 분석 및 저장 완료', matchId: commonMatch });
  } catch (err) {
    console.error('매치 분석 실패:', err.message);
    res.status(500).json({ error: '분석 중 오류 발생' });
  }
});

module.exports = router;
