// 개선된 백엔드 팀 배정 로직
const express = require('express');
const router = express.Router();

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function assignRoles(team) {
  const used = new Set();
  const assigned = [];

  const sortedTeam = [...team].sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0));

  for (const player of sortedTeam) {
    const preferences = [player.mainRole, ...(player.backupRoles || [])];
    const available = preferences.find(role => !used.has(role));
    if (!available) return null;
    used.add(available);
    assigned.push({ ...player, assignedRole: available });
  }

  return assigned;
}

function getCombinations(arr, r) {
  const results = [];
  const recur = (start, combo) => {
    if (combo.length === r) {
      results.push(combo);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      recur(i + 1, [...combo, arr[i]]);
    }
  };
  recur(0, []);
  return results;
}

function getTeamScore(team) {
  return team.reduce((acc, p) => acc + (p.totalScore || 0), 0);
}

function countSubRoles(team) {
  return team.filter(p => p.assignedRole !== p.mainRole).length;
}

function countMainRoles(team) {
  return team.filter(p => p.assignedRole === p.mainRole).length;
}

function getRoleMatchupDiff(teamA, teamB) {
  let sum = 0;
  for (const role of ROLES) {
    const a = teamA.find(p => p.assignedRole === role);
    const b = teamB.find(p => p.assignedRole === role);
    if (!a || !b) {
      sum += ((a?.totalScore || b?.totalScore || 1000) * 0.4); // 가중 패널티
    } else {
      sum += Math.abs((a.totalScore || 0) - (b.totalScore || 0));
    }
  }
  return sum;
}

function getTeamVariance(team) {
  const scores = team.map(p => p.totalScore || 0);
  return Math.max(...scores) - Math.min(...scores);
}

function getTierPenaltyMultiplier(score) {
  const clamped = Math.max(400, Math.min(4000, score));
  return 1.5 - ((clamped - 400) / 3600) * 1.3; // 1.5 ~ 0.2
}

function evaluateTeamSplit(teamA, teamB) {
  const teamAScore = getTeamScore(teamA);
  const teamBScore = getTeamScore(teamB);
  const scoreDiff = Math.abs(teamAScore - teamBScore);

  const subPositionCount = countSubRoles(teamA) + countSubRoles(teamB);
  const roleMatchupDiff = getRoleMatchupDiff(teamA, teamB);
  const variance = getTeamVariance(teamA) + getTeamVariance(teamB);
  const mainRoleCount = countMainRoles(teamA) + countMainRoles(teamB);

  const avgTierScore = (teamAScore + teamBScore) / 2;
  const tierMultiplier = getTierPenaltyMultiplier(avgTierScore);
  const mainRoleBonusScore = Math.max(0, (mainRoleCount - subPositionCount)) * 10 * tierMultiplier;

  const weights = {
    scoreDiff: 1.0,
    subPosPenalty: 30.0,
    roleMismatch: 6.0,
    variancePenalty: 6.0,
  };

  const finalScore =
    weights.scoreDiff * Math.pow(scoreDiff, 1.1) +
    weights.subPosPenalty * Math.pow(subPositionCount, 1.2) +
    weights.roleMismatch * Math.pow(roleMatchupDiff, 1.05) +
    weights.variancePenalty * variance -
    mainRoleBonusScore;

  return {
    teamA,
    teamB,
    teamAScore,
    teamBScore,
    scoreDiff,
    subPositionCount,
    roleMatchupDiff,
    variance,
    mainRoleCount,
    mainRoleBonusScore: Math.floor(mainRoleBonusScore),
    finalScore: Math.floor(finalScore),
    fallbackUsed: false,
    scoreBreakdown: {
      scoreDiff,
      subPositionCount,
      roleMatchupDiff,
      variance,
      mainRoleCount,
      tierMultiplier: Number(tierMultiplier.toFixed(3)),
      mainRoleBonusScore: Math.floor(mainRoleBonusScore),
      finalScore: Math.floor(finalScore)
    }
  };
}

function hasSufficientRoles(players) {
  const counts = ROLES.reduce((acc, r) => (acc[r] = 0, acc), {});
  for (const p of players) if (counts[p.mainRole] !== undefined) counts[p.mainRole]++;
  return ROLES.every(r => counts[r] >= 1);
}

function assignTeams(players) {
  const combinations = getCombinations(players, 5);
  let best = null;
  for (const teamA of combinations) {
    const teamB = players.filter(p => !teamA.includes(p));
    const assignedA = assignRoles(teamA);
    const assignedB = assignRoles(teamB);
    if (!assignedA || !assignedB) continue;
    const evaluated = evaluateTeamSplit(assignedA, assignedB);
    if (!best || evaluated.finalScore < best.finalScore) best = evaluated;
  }
  return best;
}

function assignTeamsByScore(players) {
  const combinations = getCombinations(players, 5);
  let best = null;
  let minDiff = Infinity;
  for (const teamA of combinations) {
    const teamB = players.filter(p => !teamA.includes(p));
    const scoreA = getTeamScore(teamA);
    const scoreB = getTeamScore(teamB);
    const diff = Math.abs(scoreA - scoreB);
    if (diff > minDiff) continue;

    const assignedA = assignRoles(teamA);
    const assignedB = assignRoles(teamB);

    best = {
      teamA: assignedA || teamA,
      teamB: assignedB || teamB,
      teamAScore: scoreA,
      teamBScore: scoreB,
      scoreDiff: diff,
      fallbackUsed: true,
      fallbackReason: assignedA && assignedB ? 'score-only fallback with role assignment' : 'score-only fallback without role assignment'
    };
    minDiff = diff;
  }
  return best;
}

function assignTeamsWithSoftRoles(players) {
  const combinations = getCombinations(players, 5);
  let best = null;
  let bestScore = Infinity;
  for (const teamA of combinations) {
    const teamB = players.filter(p => !teamA.includes(p));
    const assignedA = assignRoles(teamA);
    const assignedB = assignRoles(teamB);
    if (!assignedA || !assignedB) continue;
    const result = evaluateTeamSplit(assignedA, assignedB);
    if (result.finalScore < bestScore) {
      best = result;
      best.fallbackUsed = true;
      bestScore = result.finalScore;
    }
  }
  return best;
}

router.post('/make-teams', (req, res) => {
  const players = req.body;
  if (!Array.isArray(players) || players.length !== 10) {
    return res.status(400).json({ error: '10명의 플레이어가 필요합니다.' });
  }

  let result = null;

  if (hasSufficientRoles(players)) {
    result = assignTeams(players);
    if (!result) {
      console.log('Plan A 실패 → soft fallback');
      result = assignTeamsWithSoftRoles(players);
    }
  } else {
    console.log('포지션 부족 → soft fallback');
    result = assignTeamsWithSoftRoles(players);
  }

  if (!result) {
    console.log('Soft 실패 → 점수 fallback');
    result = assignTeamsByScore(players);
  }

  if (!result) {
    return res.status(400).json({ error: '팀 배정 실패' });
  }

  res.json(result);
});

module.exports = router;
