export function CombatantVitals({
  vitals
}: {
  vitals: {
    hpCurrent: number | null;
    hpMax: number | null;
    hpDetails?: string;
    tempHp?: number;
  };
}) {
  const tempHp = Math.max(0, Number(vitals.tempHp ?? 0) || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div>
        HP:{" "}
        {vitals.hpCurrent !== null && vitals.hpMax !== null
          ? `${vitals.hpCurrent} / ${vitals.hpMax}`
          : "—"}
        {tempHp ? <span>{` (+${tempHp}t)`}</span> : null}{" "}
        {vitals.hpDetails && <span>({vitals.hpDetails})</span>}
      </div>
    </div>
  );
}
