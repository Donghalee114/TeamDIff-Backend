const express = require('express');
const router = express.Router();

// 역할 우선 배정 함수
function assignRoles(team) {
  const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  const used = new Set();
  const assigned = [];

  for (const player of team) {
    const candidates = [player.mainRole, ...(player.backupRoles || [])];
    const assignedRole = candidates.find(r => !used.has(r));
    if (!assignedRole) return null;
    used.add(assignedRole);
    assigned.push({ ...player, assignedRole });
  }

  return assigned;
}

// 조합 함수 (nCk)
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

// 팀 점수 합
function getTeamScore(team) {
  return team.reduce((acc, p) => acc + (p.totalScore || 0), 0);
}

// 부 포지션 배정 수
function countSubRoles(team) {
  return team.filter(p => p.assignedRole !== p.mainRole).length;
}

// 메인 포지션 배정 수
function countMainRoles(team) {
  return team.filter(p => p.assignedRole === p.mainRole).length;
}

// 라인 매치업 점수 차이 계산
function getRoleMatchupDiff(teamA, teamB) {
  const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  let sum = 0;

  for (const role of roles) {
    const a = teamA.find(p => p.assignedRole === role);
    const b = teamB.find(p => p.assignedRole === role);
    if (!a || !b) {
      sum += 500; // 한쪽이 라인이 없으면 큰 패널티
    } else {
      sum += Math.abs((a.totalScore || 0) - (b.totalScore || 0));
    }
  }

  return sum;
}

// 한 팀 내 점수 편차 계산
function getTeamVariance(team) {
  const scores = team.map(p => p.totalScore || 0);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  return max - min;
}

// 조합 평가 함수
function evaluateTeamSplit(teamA, teamB) {
  const teamAScore = getTeamScore(teamA);
  const teamBScore = getTeamScore(teamB);
  const scoreDiff = Math.abs(teamAScore - teamBScore);
  const subPositionCount = countSubRoles(teamA) + countSubRoles(teamB);
  const roleMatchupDiff = getRoleMatchupDiff(teamA, teamB);
  const variance = getTeamVariance(teamA) + getTeamVariance(teamB);
  const mainRoleBonus = countMainRoles(teamA) + countMainRoles(teamB);

  const finalScore =
    scoreDiff +
    subPositionCount * 30 +
    roleMatchupDiff * 0.5 +
    variance * 1 -
    mainRoleBonus * 3;

  return {
    teamA,
    teamB,
    teamAScore,
    teamBScore,
    scoreDiff,
    subPositionCount,
    roleMatchupDiff,
    variance,
    mainRoleBonus,
    finalScore,
    fallbackUsed: false
  };
}

function hasSufficientRoles(players) {
  const requiredRoles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  const roleCounts = { TOP: 0, JUNGLE: 0, MIDDLE: 0, BOTTOM: 0, UTILITY: 0 };
  for (const player of players) {
    if (requiredRoles.includes(player.mainRole)) {
      roleCounts[player.mainRole]++;
    }
  }
  return requiredRoles.every(role => roleCounts[role] >= 1);
}
// 플랜 A: 라인 기반 + 평가 기준 적용한 팀 구성
function assignTeams(players) {
  const combinations = getCombinations(players, 5);
  let best = null;

  for (const teamA of combinations) {
    const teamB = players.filter(p => !teamA.includes(p));

    const assignedA = assignRoles(teamA);
    const assignedB = assignRoles(teamB);

    if (!assignedA || !assignedB) continue;

    const evaluated = evaluateTeamSplit(assignedA, assignedB);
    if (!best || evaluated.finalScore < best.finalScore) {
      best = evaluated;
    }
  }

  return best;
}

// 플랜 B: 점수 기반 fallback
function assignTeamsByScore(players) {
  const combinations = getCombinations(players, 5);
  let best = null;
  let minDiff = Infinity;

  for (const teamA of combinations) {
    const teamB = players.filter(p => !teamA.includes(p));
    const scoreA = getTeamScore(teamA);
    const scoreB = getTeamScore(teamB);
    const diff = Math.abs(scoreA - scoreB);

    if (diff < minDiff) {
      best = {
        teamA,
        teamB,
        teamAScore: scoreA,
        teamBScore: scoreB,
        scoreDiff: diff,
        fallbackUsed: true
      };
      minDiff = diff;
    }
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

    // fallback임에도 assignRoles 실패 시, 강제로 역할 배정 시도 안 함
    if (!assignedA || !assignedB) continue;

    const teamAScore = getTeamScore(assignedA);
    const teamBScore = getTeamScore(assignedB);
    const scoreDiff = Math.abs(teamAScore - teamBScore);
    const subPositionCount = countSubRoles(assignedA) + countSubRoles(assignedB);
    const roleMatchupDiff = getRoleMatchupDiff(assignedA, assignedB);
    const variance = getTeamVariance(assignedA) + getTeamVariance(assignedB);
    const mainRoleBonus = countMainRoles(assignedA) + countMainRoles(assignedB);

    const finalScore =
      scoreDiff +
      subPositionCount * 15 + // fallback이므로 패널티 낮춤
      roleMatchupDiff * 0.5 +
      variance * 1 -
      mainRoleBonus * 2;

    if (finalScore < bestScore) {
      best = {
        teamA: assignedA,
        teamB: assignedB,
        teamAScore,
        teamBScore,
        scoreDiff,
        subPositionCount,
        roleMatchupDiff,
        variance,
        mainRoleBonus,
        finalScore,
        fallbackUsed: true
      };
      bestScore = finalScore;
    }
  }

  return best;
}

// API 핸들러
// 사용 예 (router 내부)
router.post('/make-teams', (req, res) => {
  const players = req.body;
  if (!Array.isArray(players) || players.length !== 10) {
    return res.status(400).json({ error: '10명의 플레이어가 필요합니다.' });
  }

  let result;

  // 1단계: 라인 기준 팀 구성 시도
  if (hasSufficientRoles(players)) {
    result = assignTeams(players);
    if (!result) {
      console.log('Plan A 실패 → soft fallback 사용');
      result = assignTeamsWithSoftRoles(players);
    }
  } else {
    console.log('필수 포지션 부족 → soft fallback 사용');
    result = assignTeamsWithSoftRoles(players);
  }

  // 2단계: soft fallback도 실패하면 → 진짜 fallback
  if (!result) {
    console.log('Soft fallback 실패 → 점수 기반 fallback 사용');
    result = assignTeamsByScore(players);
    result.fallbackUsed = true;
  }

  if (!result) {
    return res.status(400).json({ error: '팀 배정에 실패했습니다.' });
  }

  res.json(result);
});


module.exports = router;
