const express = require('express');
const router = express.Router();

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function assignRolesBestEffort(team) {
  const used = new Set();
  const assigned = [];
  const sortedTeam = [...team].sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0));

  for (const player of sortedTeam) {
    const preferences = [player.mainRole, ...(player.backupRoles || [])];
    const available = preferences.find(role => !used.has(role));
    const assignedRole = available || "UNASSIGNED";
    if (assignedRole) used.add(assignedRole);
    assigned.push({ ...player, assignedRole });
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

function countRoleConflicts(team) {
  const seen = new Set();
  let count = 0;
  for (const p of team) {
    if (!p.assignedRole) continue;
    if (seen.has(p.assignedRole)) count++;
    seen.add(p.assignedRole);
  }
  return count;
}

function hasDuplicateRoles(team) {
  const roleCounts = {};
  for (const p of team) {
    if (!p.assignedRole) continue;
    roleCounts[p.assignedRole] = (roleCounts[p.assignedRole] || 0) + 1;
    if (roleCounts[p.assignedRole] > 1) return true;
  }
  return false;
}

function getRoleMatchupDiff(teamA, teamB) {
  let sum = 0;
  for (const role of ROLES) {
    const a = teamA.find(p => p.assignedRole === role);
    const b = teamB.find(p => p.assignedRole === role);
    if (!a || !b) {
      sum += 1000;
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
  return 1.5 - ((clamped - 400) / 3600) * 1.3;
}

function evaluateTeamSplit(teamA, teamB) {
  const teamAScore = getTeamScore(teamA);
  const teamBScore = getTeamScore(teamB);
  const scoreDiff = Math.abs(teamAScore - teamBScore);
  const subPositionCount = countSubRoles(teamA) + countSubRoles(teamB);
  const roleMatchupDiff = getRoleMatchupDiff(teamA, teamB);
  const variance = getTeamVariance(teamA) + getTeamVariance(teamB);
  const mainRoleCount = countMainRoles(teamA) + countMainRoles(teamB);
  const roleConflicts = countRoleConflicts(teamA) + countRoleConflicts(teamB);

  const avgTierScore = (teamAScore + teamBScore) / 2;
  const tierMultiplier = getTierPenaltyMultiplier(avgTierScore);
  const mainRoleBonusScore = Math.max(0, (mainRoleCount - subPositionCount)) * 10 * tierMultiplier;

  const roleGroupDiff = ROLES.reduce((sum, role) => {
    const a = teamA.find(p => p.assignedRole === role)?.totalScore || 0;
    const b = teamB.find(p => p.assignedRole === role)?.totalScore || 0;
    return sum + Math.abs(a - b);
  }, 0);

  const tierGapPenalty =
    (Math.max(...teamA.map(p => p.totalScore)) - Math.min(...teamA.map(p => p.totalScore))) +
    (Math.max(...teamB.map(p => p.totalScore)) - Math.min(...teamB.map(p => p.totalScore)));

  const positionDiversityPenalty =
    ROLES.filter(r => !teamA.find(p => p.assignedRole === r)).length +
    ROLES.filter(r => !teamB.find(p => p.assignedRole === r)).length;

  const weights = {
    scoreDiff: 1.0,
    subPosPenalty: 40.0,
    roleMismatch: 10.0,
    variancePenalty: 6.0,
    roleGroupPenalty: 4.0,
    tierGapPenalty: 4.0,
    diversityPenalty: 20.0,
    roleConflictPenalty: 30.0
  };

  const finalScore =
    weights.scoreDiff * Math.pow(scoreDiff, 1.1) +
    weights.subPosPenalty * Math.pow(subPositionCount, 1.2) +
    weights.roleMismatch * Math.pow(roleMatchupDiff, 1.05) +
    weights.variancePenalty * variance +
    weights.roleGroupPenalty * roleGroupDiff +
    weights.tierGapPenalty * tierGapPenalty +
    weights.diversityPenalty * positionDiversityPenalty +
    weights.roleConflictPenalty * roleConflicts - mainRoleBonusScore;

  return {
    teamA, teamB, teamAScore, teamBScore, scoreDiff,
    subPositionCount, roleMatchupDiff, roleGroupDiff,
    variance, tierGapPenalty, positionDiversityPenalty,
    mainRoleCount, roleConflicts,
    mainRoleBonusScore: Math.floor(mainRoleBonusScore),
    finalScore: Math.floor(finalScore),
    fallbackUsed: false,
    scoreBreakdown: {
      scoreDiff, subPositionCount, roleMatchupDiff,
      roleGroupDiff, variance, tierGapPenalty,
      positionDiversityPenalty, mainRoleCount,
      roleConflicts, tierMultiplier: Number(tierMultiplier.toFixed(3)),
      mainRoleBonusScore: Math.floor(mainRoleBonusScore),
      finalScore: Math.floor(finalScore)
    }
  };
}

function assignTeams(players) {
  const combinations = getCombinations(players, 5);
  let best = null;
  let bestScore = Infinity;

  for (const combo of combinations) {
    const rest = players.filter(p => !combo.includes(p));
    const teamA = assignRolesBestEffort(combo);
    const teamB = assignRolesBestEffort(rest);
    if (hasDuplicateRoles(teamA) || hasDuplicateRoles(teamB)) continue;

    const evalResult = evaluateTeamSplit(teamA, teamB);
    if (evalResult.finalScore < bestScore) {
      best = evalResult;
      bestScore = evalResult.finalScore;
    }
  }

  return best;
}

function getUnassignedRoleCount(team) {
  return team.filter(p => !p.assignedRole).length;
}

function getDuplicateRoleCount(team) {
  const roleCounts = {};
  for (const p of team) {
    if (!p.assignedRole) continue;
    roleCounts[p.assignedRole] = (roleCounts[p.assignedRole] || 0) + 1;
  }
  return Object.values(roleCounts).filter(c => c > 1).length;
}

router.post('/make-teams', (req, res) => {
  const players = req.body;
  if (!Array.isArray(players) || players.length !== 10) {
    return res.status(400).json({ error: '10명의 플레이어가 필요합니다.' });
  }

  const result = assignTeams(players);
  if (!result) {
    return res.status(400).json({ error: '팀 배정 실패 (포지션 중복 또는 구성이 불가능)' });
  }

  const teamAConflict = getDuplicateRoleCount(result.teamA);
  const teamBConflict = getDuplicateRoleCount(result.teamB);
  const totalUnassigned = getUnassignedRoleCount(result.teamA) + getUnassignedRoleCount(result.teamB);

  const conflictDetected = (teamAConflict > 0 || teamBConflict > 0 || totalUnassigned > 0);

  res.json({
    ...result,
    conflict: conflictDetected,
    message: conflictDetected
      ? '일부 포지션이 중복되었거나 배정되지 않았습니다. 주/부 포지션을 다양하게 설정해주세요.'
      : '라인과 실력 점수를 기준으로 팀이 안정적으로 구성되었습니다.'
  });
});

module.exports = router;
