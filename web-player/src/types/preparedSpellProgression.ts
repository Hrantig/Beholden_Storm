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
