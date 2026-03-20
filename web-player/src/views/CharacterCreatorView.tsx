import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Select } from "@/ui/Select";

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface ClassSummary { id: string; name: string; hd: number | null }
interface ClassDetail {
  id: string; name: string; hd: number | null;
  proficiency: string; armor: string; weapons: string;
  description: string;
  autolevels: {
    level: number; scoreImprovement: boolean;
    features: { name: string; text: string; optional: boolean }[];
    counters: { name: string; value: number; reset: string }[];
  }[];
}
interface RaceSummary { id: string; name: string; size: string | null; speed: number | null }
interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null;
  resist: string | null;
  traits: { name: string; text: string; category: string | null; modifier: string[] }[];
}
interface BgSummary { id: string; name: string }
interface BgDetail {
  id: string; name: string; proficiency: string;
  traits: { name: string; text: string }[];
}
interface Campaign { id: string; name: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const POINT_BUY_BUDGET = 27;

function abilityMod(score: number) { return Math.floor((score - 10) / 2); }

function calcHpMax(hd: number, level: number, conMod: number): number {
  if (level <= 0) return hd + conMod;
  return hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
}

function getSubclassLevel(cls: ClassDetail | null): number | null {
  if (!cls) return null;
  for (const al of cls.autolevels) {
    for (const f of al.features) {
      if (/subclass/i.test(f.name) && !f.optional) return al.level;
    }
  }
  return null;
}

function featuresUpToLevel(cls: ClassDetail, level: number) {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) => al.features.filter((f) => !f.optional).map((f) => ({ ...f, level: al.level })));
}

function getSubclassList(cls: ClassDetail): string[] {
  const names: string[] = [];
  for (const al of cls.autolevels) {
    for (const f of al.features) {
      if (f.optional && /subclass:/i.test(f.name)) {
        const label = f.name.replace(/^[^:]+:\s*/i, "").trim();
        if (label && !names.includes(label)) names.push(label);
      }
    }
  }
  return names;
}

function pointBuySpent(scores: Record<string, number>): number {
  return ABILITY_KEYS.reduce((sum, k) => {
    const s = Math.min(15, Math.max(8, scores[k] ?? 8));
    return sum + (POINT_BUY_COSTS[s] ?? 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type AbilityMethod = "standard" | "pointbuy" | "manual";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface FormState {
  classId: string;
  raceId: string;
  bgId: string;
  level: number;
  subclass: string;
  abilityMethod: AbilityMethod;
  // Standard array: which stat gets which array value (by index)
  standardAssign: Record<string, number>; // stat -> index into STANDARD_ARRAY
  // Point buy scores
  pbScores: Record<string, number>;
  // Manual scores
  manualScores: Record<string, number>;
  // Derived (editable)
  hpMax: string;
  ac: string;
  speed: string;
  // Identity
  characterName: string;
  playerName: string;
  color: string;
  // Campaign assignment
  campaignIds: string[];
}

const DEFAULT_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function initForm(user: { name?: string } | null, params: URLSearchParams): FormState {
  const preselectedCampaign = params.get("campaign");
  return {
    classId: "", raceId: "", bgId: "",
    level: 1, subclass: "",
    abilityMethod: "standard",
    standardAssign: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    pbScores: { ...DEFAULT_SCORES },
    manualScores: { ...DEFAULT_SCORES },
    hpMax: "", ac: "10", speed: "30",
    characterName: "", playerName: user?.name ?? "",
    color: "#38b6ff",
    campaignIds: preselectedCampaign ? [preselectedCampaign] : [],
  };
}

function resolvedScores(form: FormState): Record<string, number> {
  if (form.abilityMethod === "manual") return { ...form.manualScores };
  if (form.abilityMethod === "pointbuy") return { ...form.pbScores };
  // standard array
  const out: Record<string, number> = {};
  for (const k of ABILITY_KEYS) {
    const idx = form.standardAssign[k];
    out[k] = idx >= 0 ? STANDARD_ARRAY[idx] : 8;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StepHeader({ step, current }: { step: number; current: Step }) {
  const STEPS = ["Class", "Species", "Background", "Level", "Ability Scores", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === current;
        const done = n < current;
        return (
          <div key={n} style={{
            padding: "5px 13px", borderRadius: 20,
            background: active ? C.accentHl : done ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.06)",
            color: active ? C.textDark : done ? C.accentHl : "rgba(160,180,220,0.50)",
            fontWeight: active ? 700 : done ? 600 : 500,
            fontSize: 12,
            border: `1px solid ${active ? C.accentHl : done ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.10)"}`,
          }}>
            {done ? "✓ " : `${n}. `}{label}
          </div>
        );
      })}
    </div>
  );
}

function NavButtons({ step, onBack, onNext, nextLabel = "Next →", nextDisabled = false }: {
  step: Step; onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <button type="button" onClick={onBack} disabled={step === 1} style={btnStyle(false, step === 1)}>
        ← Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} style={btnStyle(true, nextDisabled)}>
        {nextLabel}
      </button>
    </div>
  );
}

function btnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 22px", borderRadius: 8, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : primary
        ? C.accentHl
        : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(160,180,220,0.40)" : primary ? C.textDark : C.text,
    fontSize: 14,
    transition: "opacity 0.15s",
  };
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
      {children}
    </div>
  );
}

function SelectableCard({ selected, onClick, title, subtitle }: {
  selected: boolean; onClick: () => void; title: string; subtitle?: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "13px 15px", borderRadius: 10, textAlign: "left",
      border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
      background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
      color: C.text, cursor: "pointer",
      boxShadow: selected ? `0 0 0 1px ${C.accentHl}22` : "none",
      transition: "border-color 0.12s, background 0.12s",
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: selected ? C.accentHl : C.text }}>{title}</div>
      {subtitle && <div style={{ color: selected ? "rgba(56,182,255,0.75)" : "rgba(160,180,220,0.6)", fontSize: 12, marginTop: 3 }}>{subtitle}</div>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [busy, setBusy] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(isEditing);
  const [error, setError] = React.useState<string | null>(null);

  // Compendium data
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [classDetail, setClassDetail] = React.useState<ClassDetail | null>(null);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [raceDetail, setRaceDetail] = React.useState<RaceDetail | null>(null);
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [bgDetail, setBgDetail] = React.useState<BgDetail | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  // Load compendium lists on mount
  React.useEffect(() => {
    api<ClassSummary[]>("/api/compendium/classes").then(setClasses).catch(() => {});
    api<RaceSummary[]>("/api/compendium/races").then(setRaces).catch(() => {});
    api<BgSummary[]>("/api/compendium/backgrounds").then(setBgs).catch(() => {});
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
  }, []);

  // Load existing character when editing
  React.useEffect(() => {
    if (!editId) return;
    api<any>(`/api/me/characters/${editId}`)
      .then((ch) => {
        const cd = ch.characterData ?? {};
        setForm((f) => ({
          ...f,
          classId: cd.classId ?? "",
          raceId: cd.raceId ?? "",
          bgId: cd.bgId ?? "",
          level: ch.level ?? 1,
          subclass: cd.subclass ?? "",
          abilityMethod: "manual",
          manualScores: {
            str: ch.strScore ?? 10, dex: ch.dexScore ?? 10, con: ch.conScore ?? 10,
            int: ch.intScore ?? 10, wis: ch.wisScore ?? 10, cha: ch.chaScore ?? 10,
          },
          hpMax: String(ch.hpMax ?? 0),
          ac: String(ch.ac ?? 10),
          speed: String(ch.speed ?? 30),
          characterName: ch.name ?? "",
          playerName: ch.playerName ?? "",
          color: ch.color ?? "#38b6ff",
          campaignIds: (ch.campaigns ?? []).map((c: any) => c.campaignId),
        }));
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load class detail when selected
  React.useEffect(() => {
    if (!form.classId) { setClassDetail(null); return; }
    api<ClassDetail>(`/api/compendium/classes/${form.classId}`).then(setClassDetail).catch(() => {});
  }, [form.classId]);

  // Load race detail when selected
  React.useEffect(() => {
    if (!form.raceId) { setRaceDetail(null); return; }
    api<RaceDetail>(`/api/compendium/races/${form.raceId}`).then(setRaceDetail).catch(() => {});
  }, [form.raceId]);

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    api<BgDetail>(`/api/compendium/backgrounds/${form.bgId}`).then(setBgDetail).catch(() => {});
  }, [form.bgId]);

  // Auto-calculate HP, speed when class/race/scores change
  React.useEffect(() => {
    const hd = classDetail?.hd ?? 8;
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const hp = calcHpMax(hd, form.level, conMod);
    const baseSpeed = raceDetail?.speed ?? 30;
    setForm((f) => ({ ...f, hpMax: String(hp), speed: String(baseSpeed) }));
  }, [classDetail, raceDetail, form.level, form.abilityMethod, form.standardAssign, form.pbScores, form.manualScores]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.characterName.trim()) { setError("Character name is required."); return; }
    setBusy(true); setError(null);
    try {
      const scores = resolvedScores(form);
      const body = {
        name: form.characterName.trim(),
        playerName: form.playerName.trim(),
        className: classDetail?.name ?? form.characterName,
        species: raceDetail?.name ?? "",
        level: form.level,
        hpMax: Number(form.hpMax) || 0,
        hpCurrent: Number(form.hpMax) || 0,
        ac: Number(form.ac) || 10,
        speed: Number(form.speed) || 30,
        strScore: scores.str, dexScore: scores.dex, conScore: scores.con,
        intScore: scores.int, wisScore: scores.wis, chaScore: scores.cha,
        color: form.color,
        characterData: {
          classId: form.classId, raceId: form.raceId, bgId: form.bgId,
          subclass: form.subclass || null, abilityMethod: form.abilityMethod,
        },
      };

      let charId: string;
      if (isEditing && editId) {
        await api(`/api/me/characters/${editId}`, jsonInit("PUT", body));
        charId = editId;
      } else {
        const created = await api<{ id: string }>("/api/me/characters", jsonInit("POST", body));
        charId = created.id;
      }

      if (form.campaignIds.length > 0) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
      }

      navigate("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save character.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 1: return <StepClass />;
      case 2: return <StepSpecies />;
      case 3: return <StepBackground />;
      case 4: return <StepLevel />;
      case 5: return <StepAbilityScores />;
      case 6: return <StepDerivedStats />;
      case 7: return <StepIdentity />;
      case 8: return <StepCampaigns />;
    }
  }

  // Step 1: Class
  function StepClass() {
    return (
      <div>
        <h2 style={headingStyle}>Choose a Class</h2>
        {classes.length === 0 && <p style={{ color: C.muted }}>No classes found. Ask your DM to upload a class compendium XML.</p>}
        <CardGrid>
          {classes.map((c) => (
            <SelectableCard key={c.id} selected={form.classId === c.id}
              onClick={() => set("classId", c.id)}
              title={c.name} subtitle={c.hd ? `d${c.hd} hit die` : undefined} />
          ))}
        </CardGrid>

        {classDetail && (
          <div style={detailBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Proficiencies</div>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 8 }}>{classDetail.proficiency}</div>
            {classDetail.armor && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Armor: {classDetail.armor}</div>}
            {classDetail.weapons && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Weapons: {classDetail.weapons}</div>}
            {classDetail.description && (
              <div style={{ marginTop: 8, color: C.text, fontSize: "var(--fs-small)", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}>
                {classDetail.description.slice(0, 400)}{classDetail.description.length > 400 ? "…" : ""}
              </div>
            )}
          </div>
        )}

        <NavButtons step={step} onBack={() => {}} onNext={() => setStep(2)}
          nextDisabled={!form.classId} />
      </div>
    );
  }

  // Step 2: Species
  function StepSpecies() {
    return (
      <div>
        <h2 style={headingStyle}>Choose a Species</h2>
        {races.length === 0 && <p style={{ color: C.muted }}>No species found in compendium.</p>}
        <CardGrid>
          {races.map((r) => (
            <SelectableCard key={r.id} selected={form.raceId === r.id}
              onClick={() => set("raceId", r.id)}
              title={r.name} subtitle={r.speed ? `Speed ${r.speed} ft` : undefined} />
          ))}
        </CardGrid>

        {raceDetail && (
          <div style={detailBoxStyle}>
            {raceDetail.traits.filter((t) => t.category !== "description").slice(0, 4).map((t) => (
              <div key={t.name} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: C.accentHl }}>{t.name}.</span>{" "}
                <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t.text.slice(0, 120)}{t.text.length > 120 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(1)} onNext={() => setStep(3)}
          nextDisabled={!form.raceId} />
      </div>
    );
  }

  // Step 3: Background
  function StepBackground() {
    return (
      <div>
        <h2 style={headingStyle}>Choose a Background</h2>
        {bgs.length === 0 && <p style={{ color: C.muted }}>No backgrounds found in compendium.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bgs.map((b) => (
            <button type="button" key={b.id} onClick={() => set("bgId", b.id)} style={{
              padding: "11px 15px", borderRadius: 8, textAlign: "left",
              border: `2px solid ${form.bgId === b.id ? C.accentHl : "rgba(255,255,255,0.12)"}`,
              background: form.bgId === b.id ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
              color: form.bgId === b.id ? C.accentHl : C.text, cursor: "pointer",
              fontWeight: form.bgId === b.id ? 700 : 500, fontSize: 14,
              transition: "border-color 0.12s, background 0.12s",
            }}>{b.name}</button>
          ))}
        </div>

        {bgDetail && (
          <div style={detailBoxStyle}>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              Skills: {bgDetail.proficiency}
            </div>
            {bgDetail.traits.slice(0, 2).map((t) => (
              <div key={t.name} style={{ marginBottom: 4, fontSize: "var(--fs-small)" }}>
                <span style={{ fontWeight: 700, color: C.accentHl }}>{t.name}.</span>{" "}
                <span style={{ color: C.muted }}>{t.text.slice(0, 100)}{t.text.length > 100 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(2)} onNext={() => setStep(4)}
          nextDisabled={!form.bgId} />
      </div>
    );
  }

  // Step 4: Level
  function StepLevel() {
    const subclassLevel = getSubclassList(classDetail!);
    const scNeeded = classDetail ? (getSubclassLevel(classDetail) ?? 99) : 99;
    const showSubclass = classDetail && form.level >= scNeeded && subclassLevel.length > 0;
    const features = classDetail ? featuresUpToLevel(classDetail, form.level) : [];

    return (
      <div>
        <h2 style={headingStyle}>Choose Level</h2>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
          <label style={{ color: C.muted }}>Level</label>
          <input type="number" min={1} max={20} value={form.level}
            onChange={(e) => set("level", Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            style={inputStyle} />
        </div>

        {showSubclass && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: C.muted, display: "block", marginBottom: 6 }}>Subclass</label>
            <Select value={form.subclass} onChange={(e) => set("subclass", e.target.value)} style={{ width: 260 }}>
              <option value="">— Choose subclass —</option>
              {subclassLevel.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        )}

        <div style={{ ...detailBoxStyle, maxHeight: 280, overflowY: "auto" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Features at Level {form.level}</div>
          {features.length === 0 && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No features yet.</div>}
          {features.map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.accentHl }}>Lv{f.level} {f.name}</div>
              <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
                {f.text.slice(0, 200)}{f.text.length > 200 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>

        <NavButtons step={step} onBack={() => setStep(3)} onNext={() => setStep(5)} />
      </div>
    );
  }

  // Step 5: Ability Scores
  function StepAbilityScores() {
    const usedIndices = Object.values(form.standardAssign).filter((v) => v >= 0);
    const spent = pointBuySpent(form.pbScores);
    const remaining = POINT_BUY_BUDGET - spent;

    return (
      <div>
        <h2 style={headingStyle}>Ability Scores</h2>

        {/* Method tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["standard", "pointbuy", "manual"] as AbilityMethod[]).map((m) => (
            <button key={m} type="button" onClick={() => set("abilityMethod", m)} style={{
              padding: "7px 16px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${form.abilityMethod === m ? C.accentHl : "rgba(255,255,255,0.14)"}`,
              background: form.abilityMethod === m ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
              color: form.abilityMethod === m ? C.accentHl : "rgba(160,180,220,0.7)",
              fontWeight: form.abilityMethod === m ? 700 : 500, fontSize: 13,
            }}>
              {m === "standard" ? "Standard Array" : m === "pointbuy" ? "Point Buy" : "Manual"}
            </button>
          ))}
        </div>

        {form.abilityMethod === "standard" && (
          <div>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 12 }}>
              Assign each value to one ability: {STANDARD_ARRAY.join(", ")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ABILITY_KEYS.map((k) => {
                const assigned = form.standardAssign[k];
                const availableValues = STANDARD_ARRAY.filter((_, i) =>
                  i === assigned || !usedIndices.includes(i)
                );
                return (
                  <div key={k}>
                    <label style={{ color: C.muted, fontSize: "var(--fs-small)", display: "block", marginBottom: 4 }}>
                      {ABILITY_LABELS[k]}
                    </label>
                    <Select value={assigned >= 0 ? String(assigned) : ""} onChange={(e) => {
                      const idx = e.target.value === "" ? -1 : Number(e.target.value);
                      setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [k]: idx } }));
                    }} style={{ width: "100%" }}>
                      <option value="">—</option>
                      {STANDARD_ARRAY.map((v, i) => (
                        !usedIndices.includes(i) || i === assigned
                          ? <option key={i} value={String(i)}>{v}</option>
                          : null
                      ))}
                    </Select>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, textAlign: "center" }}>
                      {assigned >= 0 ? `mod ${abilityMod(STANDARD_ARRAY[assigned]) >= 0 ? "+" : ""}${abilityMod(STANDARD_ARRAY[assigned])}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {form.abilityMethod === "pointbuy" && (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Points remaining:</span>
              <span style={{ fontWeight: 700, color: remaining < 0 ? C.red : C.accentHl }}>{remaining} / {POINT_BUY_BUDGET}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ABILITY_KEYS.map((k) => {
                const score = form.pbScores[k] ?? 8;
                return (
                  <div key={k} style={{ textAlign: "center" }}>
                    <label style={{ color: C.muted, fontSize: "var(--fs-small)", display: "block", marginBottom: 4 }}>{ABILITY_LABELS[k]}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      <button type="button" disabled={score <= 8} onClick={() => setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [k]: score - 1 } }))}
                        style={{ ...smallBtnStyle, opacity: score <= 8 ? 0.4 : 1 }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 24 }}>{score}</span>
                      <button type="button" disabled={score >= 15 || remaining < (POINT_BUY_COSTS[score + 1] ?? 99) - (POINT_BUY_COSTS[score] ?? 0)}
                        onClick={() => setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [k]: score + 1 } }))}
                        style={{ ...smallBtnStyle, opacity: (score >= 15 || remaining < (POINT_BUY_COSTS[score + 1] ?? 99) - (POINT_BUY_COSTS[score] ?? 0)) ? 0.4 : 1 }}>+</button>
                    </div>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                      mod {abilityMod(score) >= 0 ? "+" : ""}{abilityMod(score)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {form.abilityMethod === "manual" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {ABILITY_KEYS.map((k) => {
              const score = form.manualScores[k] ?? 10;
              return (
                <div key={k}>
                  <label style={{ color: C.muted, fontSize: "var(--fs-small)", display: "block", marginBottom: 4 }}>{ABILITY_LABELS[k]}</label>
                  <input type="number" value={score}
                    onChange={(e) => setForm((f) => ({ ...f, manualScores: { ...f.manualScores, [k]: Number(e.target.value) || 10 } }))}
                    style={{ ...inputStyle, width: "100%" }} />
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                    mod {abilityMod(score) >= 0 ? "+" : ""}{abilityMod(score)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(4)} onNext={() => setStep(6)} />
      </div>
    );
  }

  // Step 6: Derived Stats
  function StepDerivedStats() {
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const hd = classDetail?.hd ?? 8;
    return (
      <div>
        <h2 style={headingStyle}>Combat Stats</h2>
        <p style={{ color: C.muted, marginBottom: 16 }}>Auto-calculated from your choices — override freely.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>HP Max</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              d{hd} + {conMod >= 0 ? "+" : ""}{conMod} CON × lvl {form.level}
            </div>
            <input type="number" value={form.hpMax} onChange={(e) => set("hpMax", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Armor Class</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              10 + {dexMod >= 0 ? "+" : ""}{dexMod} DEX (base)
            </div>
            <input type="number" value={form.ac} onChange={(e) => set("ac", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Speed (ft)</label>
            <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>
              From species ({raceDetail?.speed ?? 30} ft)
            </div>
            <input type="number" value={form.speed} onChange={(e) => set("speed", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>
        <NavButtons step={step} onBack={() => setStep(5)} onNext={() => setStep(7)} />
      </div>
    );
  }

  // Step 7: Identity
  function StepIdentity() {
    const COLORS = ["#38b6ff", "#5ecb6b", "#f0a500", "#ff5d5d", "#a78bfa", "#fb923c", "#e879f9", "#94a3b8"];
    return (
      <div>
        <h2 style={headingStyle}>Character Identity</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
          <div>
            <label style={labelStyle}>Character Name *</label>
            <input value={form.characterName} onChange={(e) => set("characterName", e.target.value)}
              placeholder="Thraxil the Destroyer" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Player Name</label>
            <input value={form.playerName} onChange={(e) => set("playerName", e.target.value)}
              placeholder="Your name" style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set("color", c)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, border: `2px solid ${form.color === c ? C.text : "transparent"}`,
                  cursor: "pointer", padding: 0,
                }} />
              ))}
            </div>
          </div>
        </div>
        <NavButtons step={step} onBack={() => setStep(6)} onNext={() => setStep(8)}
          nextDisabled={!form.characterName.trim()} />
      </div>
    );
  }

  // Step 8: Campaigns
  function StepCampaigns() {
    return (
      <div>
        <h2 style={headingStyle}>Assign to Campaigns</h2>
        <p style={{ color: C.muted, marginBottom: 16 }}>Optional — you can assign later from your home page.</p>
        {campaigns.length === 0 && <p style={{ color: C.muted }}>You're not a member of any campaigns yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {campaigns.map((c) => {
            const checked = form.campaignIds.includes(c.id);
            return (
              <label key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 15px",
                borderRadius: 8, cursor: "pointer",
                border: `2px solid ${checked ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: checked ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                transition: "border-color 0.12s, background 0.12s",
              }}>
                <input type="checkbox" checked={checked} onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    campaignIds: e.target.checked
                      ? [...f.campaignIds, c.id]
                      : f.campaignIds.filter((id) => id !== c.id),
                  }));
                }} style={{ accentColor: C.accentHl, width: 16, height: 16 }} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
              </label>
            );
          })}
        </div>

        {error && <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button type="button" onClick={() => setStep(7)} style={btnStyle(false, false)}>← Back</button>
          <button type="button" onClick={handleSubmit} disabled={busy} style={btnStyle(true, busy)}>
            {busy ? "Saving…" : isEditing ? "Save Changes ✓" : "Create Character ✓"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (editLoading) {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px", color: C.muted }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 28px" }}>
        <h1 style={{ fontWeight: 900, fontSize: "var(--fs-hero)", margin: "0 0 8px", letterSpacing: -0.5 }}>
          {isEditing ? "Edit Character" : "Create Character"}
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(160,180,220,0.55)", fontSize: 13 }}>
          {isEditing ? "Update your character details below." : "Build your character step by step."}
        </p>
        <StepHeader step={step} current={step} />
        {renderStep()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  fontWeight: 900, fontSize: "var(--fs-large)", margin: "0 0 16px",
};

const detailBoxStyle: React.CSSProperties = {
  marginTop: 14, padding: "14px 16px", borderRadius: 10,
  background: "rgba(56,182,255,0.06)",
  border: "1px solid rgba(56,182,255,0.20)",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)", color: C.text,
  border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8,
  padding: "8px 11px", outline: "none", fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  color: C.muted, fontSize: "var(--fs-small)", display: "block", marginBottom: 6, fontWeight: 600,
};

const smallBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)", color: C.text, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
};
