import React from "react";
import { C } from "@/lib/theme";
import { DraggableList } from "@/ui/DraggableList";
import type { ClassFeatureEntry, PlayerNote, ResourceCounter } from "@/views/CharacterSheetTypes";
import {
  Panel,
  PanelTitle,
  panelHeaderAddBtn,
  miniPillBtn,
  restBtnStyle,
  NoteItem,
  ClassFeatureItem,
} from "@/views/CharacterViewParts";

export function CharacterSupportPanels(props: {
  accentColor: string;
  hasCampaign: boolean;
  hitDiceCurrent: number;
  hitDiceMax: number;
  hitDieSize: number | null;
  hitDieConMod: number;
  classResources: ResourceCounter[];
  playerNotesList: PlayerNote[];
  allSharedNotes: PlayerNote[];
  classFeaturesList: ClassFeatureEntry[];
  expandedNoteIds: string[];
  expandedClassFeatureIds: string[];
  onSaveHitDiceCurrent: (value: number) => Promise<void> | void;
  onShortRest: () => Promise<void> | void;
  onLongRest: () => Promise<void> | void;
  onChangeResourceCurrent: (key: string, delta: number) => Promise<void> | void;
  onOpenPlayerNoteCreate: () => void;
  onOpenSharedNoteCreate: () => void;
  onToggleNoteExpanded: (id: string) => void;
  onToggleClassFeatureExpanded: (id: string) => void;
  onOpenPlayerNoteEdit: (note: PlayerNote) => void;
  onOpenSharedNoteEdit: (note: PlayerNote) => void;
  onDeletePlayerNote: (id: string) => void;
  onDeleteSharedNote: (id: string) => void;
  onSavePlayerNotesOrder: (list: PlayerNote[]) => void;
  onSaveSharedNotesOrder: (list: PlayerNote[]) => void;
  onSaveClassFeaturesOrder: (list: ClassFeatureEntry[]) => void;
}) {
  const {
    accentColor,
    hasCampaign,
    hitDiceCurrent,
    hitDiceMax,
    hitDieSize,
    hitDieConMod,
    classResources,
    playerNotesList,
    allSharedNotes,
    classFeaturesList,
    expandedNoteIds,
    expandedClassFeatureIds,
    onSaveHitDiceCurrent,
    onShortRest,
    onLongRest,
    onChangeResourceCurrent,
    onOpenPlayerNoteCreate,
    onOpenSharedNoteCreate,
    onToggleNoteExpanded,
    onToggleClassFeatureExpanded,
    onOpenPlayerNoteEdit,
    onOpenSharedNoteEdit,
    onDeletePlayerNote,
    onDeleteSharedNote,
    onSavePlayerNotesOrder,
    onSaveSharedNotesOrder,
    onSaveClassFeaturesOrder,
  } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <PanelTitle color={accentColor}>Recovery</PanelTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 10,
            alignItems: "stretch",
          }}>
            <div style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                Hit Dice
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>
                    {hitDiceCurrent} / {hitDiceMax}
                  </div>
                  {hitDieSize != null && (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      d{hitDieSize}{hitDieConMod >= 0 ? ` + ${hitDieConMod}` : ` - ${Math.abs(hitDieConMod)}`} per die
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent - 1)}
                    disabled={hitDiceCurrent <= 0}
                    style={miniPillBtn(hitDiceCurrent > 0)}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent + 1)}
                    disabled={hitDiceCurrent >= hitDiceMax}
                    style={miniPillBtn(hitDiceCurrent < hitDiceMax)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
              <button type="button" onClick={() => void onShortRest()} style={restBtnStyle("#60a5fa")}>
                Short Rest
              </button>
              <button type="button" onClick={() => void onLongRest()} style={restBtnStyle("#34d399")}>
                Long Rest
              </button>
            </div>
          </div>

          {classResources.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                Resources
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {classResources.map((resource) => (
                  <div
                    key={resource.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto auto auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{resource.name}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {resource.reset === "S" ? "Resets on Short Rest" : resource.reset === "L" ? "Resets on Long Rest" : `Reset ${resource.reset}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onChangeResourceCurrent(resource.key, -1)}
                      disabled={resource.current <= 0}
                      style={miniPillBtn(resource.current > 0)}
                    >
                      -
                    </button>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text, minWidth: 52, textAlign: "center" }}>
                      {resource.current} / {resource.max}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onChangeResourceCurrent(resource.key, 1)}
                      disabled={resource.current >= resource.max}
                      style={miniPillBtn(resource.current < resource.max)}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelTitle color={accentColor} actions={
          <button type="button" onClick={onOpenPlayerNoteCreate} title="Add note" style={panelHeaderAddBtn(accentColor)}>
            +
          </button>
        }>Player Notes</PanelTitle>
        {playerNotesList.length ? (
          <DraggableList
            items={playerNotesList}
            expandedIds={expandedNoteIds}
            onSelect={(id) => onToggleNoteExpanded(id)}
            onReorder={(ids) => {
              const byId = Object.fromEntries(playerNotesList.map((n) => [n.id, n]));
              onSavePlayerNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            renderItem={(it) => {
              const note = playerNotesList.find((n) => n.id === it.id)!;
              return (
                <NoteItem
                  note={note}
                  expanded={expandedNoteIds.includes(it.id)}
                  accentColor={accentColor}
                  onToggle={() => onToggleNoteExpanded(it.id)}
                  onEdit={() => onOpenPlayerNoteEdit(note)}
                  onDelete={() => onDeletePlayerNote(it.id)}
                />
              );
            }}
          />
        ) : (
          <div style={{ color: C.muted, fontSize: 12 }}>No notes yet.</div>
        )}
      </Panel>

      {hasCampaign && <Panel>
        <PanelTitle color={accentColor} actions={
          <button type="button" onClick={onOpenSharedNoteCreate} title="Add shared note" style={panelHeaderAddBtn(accentColor)}>
            +
          </button>
        }>Shared Notes</PanelTitle>
        {allSharedNotes.length ? (
          <DraggableList
            items={allSharedNotes}
            expandedIds={expandedNoteIds}
            onSelect={(id) => onToggleNoteExpanded(id)}
            onReorder={(ids) => {
              const byId = Object.fromEntries(allSharedNotes.map((n) => [n.id, n]));
              onSaveSharedNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            renderItem={(it) => {
              const note = allSharedNotes.find((n) => n.id === it.id)!;
              return (
                <NoteItem
                  note={note}
                  expanded={expandedNoteIds.includes(it.id)}
                  accentColor={C.green}
                  onToggle={() => onToggleNoteExpanded(it.id)}
                  onEdit={() => onOpenSharedNoteEdit(note)}
                  onDelete={() => onDeleteSharedNote(it.id)}
                />
              );
            }}
          />
        ) : (
          <div style={{ color: C.muted, fontSize: 12 }}>No notes yet.</div>
        )}
      </Panel>}

      {classFeaturesList.length > 0 && (
        <Panel>
          <PanelTitle color={accentColor}>Player Features</PanelTitle>
          <DraggableList
            items={classFeaturesList}
            expandedIds={expandedClassFeatureIds}
            onSelect={(id) => onToggleClassFeatureExpanded(id)}
            onReorder={(ids) => {
              const byId = Object.fromEntries(classFeaturesList.map((feature) => [feature.id, feature]));
              onSaveClassFeaturesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            renderItem={(it) => {
              const feature = classFeaturesList.find((entry) => entry.id === it.id)!;
              return (
                <ClassFeatureItem
                  feature={feature}
                  expanded={expandedClassFeatureIds.includes(it.id)}
                  accentColor={accentColor}
                  onToggle={() => onToggleClassFeatureExpanded(it.id)}
                />
              );
            }}
          />
        </Panel>
      )}

      <div style={{ display: "none" }}>
        <button
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8, padding: "7px 16px", color: C.muted,
            cursor: "pointer", fontSize: 13,
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
