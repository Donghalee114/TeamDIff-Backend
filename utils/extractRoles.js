function extractMainAndBackupRoles(roleScores) {
  const sorted = Object.entries(roleScores)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const mainRole = sorted[0]?.[0] || null;
  const backupRoles = sorted.slice(1, 3).map(([role]) => role);

  return { mainRole, backupRoles };
}

module.exports = { extractMainAndBackupRoles };
