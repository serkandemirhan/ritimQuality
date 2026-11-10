/** Versions are identifiers, not decimal numbers (v1.10 follows v1.9). */
export function nextPlanVersion(versions: string[]): string {
  const used = new Set(versions);
  if (!used.size) return 'v1.0';
  let major = 1, minor = -1;
  for (const version of used) {
    const match = /^v?(\d+)\.(\d+)$/.exec(version);
    if (!match) continue;
    const a = Number(match[1]), b = Number(match[2]);
    if (a > major || a === major && b > minor) { major = a; minor = b; }
  }
  do { minor++; } while (used.has(`v${major}.${minor}`));
  return `v${major}.${minor}`;
}
