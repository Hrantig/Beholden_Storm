export interface PreparedSpellProgressionRow {
  level: number;
  spells: string[];
}

export interface PreparedSpellProgressionTable {
  label: string | null;
  levelLabel: string;
  spellLabel: string;
  rows: PreparedSpellProgressionRow[];
}

function splitList(text: string): string[] {
  return text
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePreparedSpellProgression(text: string): PreparedSpellProgressionTable[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Source:/i.test(line));

  const tables: PreparedSpellProgressionTable[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i]?.match(/^([^|]+Level)\s*\|\s*(.+)$/i);
    if (!headerMatch) continue;

    const levelLabel = headerMatch[1]!.trim();
    const spellLabel = headerMatch[2]!.trim();
    const labelCandidate = i > 0 && /:\s*$/.test(lines[i - 1] ?? "")
      ? (lines[i - 1] ?? "").replace(/:\s*$/, "").trim()
      : null;
    const rows: PreparedSpellProgressionRow[] = [];

    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (!line.includes("|")) break;
      if (/^[^|]+Level\s*\|/i.test(line)) break;

      const rowMatch = line.match(/^(\d+)\s*\|\s*(.+)$/);
      if (!rowMatch) break;

      rows.push({
        level: Number(rowMatch[1]),
        spells: splitList(rowMatch[2] ?? ""),
      });
    }

    if (rows.length > 0) {
      tables.push({
        label: labelCandidate,
        levelLabel,
        spellLabel,
        rows,
      });
      i = j - 1;
    }
  }

  return tables;
}
