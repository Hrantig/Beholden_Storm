import React from "react";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconCompendiumAlt } from "@/icons";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";

/**
 * Right sidebar tools for the Compendium view.
 * Extracted from CompendiumView (Stage 1) with no behavior/UI changes.
 */
interface ImportResult {
  imported: number;
  total: number;
  classes?: number;
  races?: number;
  backgrounds?: number;
  feats?: number;
}

export function CompendiumAdminPanel() {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");
  const [lastImport, setLastImport] = React.useState<ImportResult | null>(null);

  async function uploadCompendium() {
    if (!file) return;
    setBusy(true);
    setMsg("");
    setLastImport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<ImportResult>("/api/compendium/import/xml", { method: "POST", body: fd });
      setLastImport(result);
      setMsg("Imported.");
      await api<unknown>("/api/meta");
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompendium() {
    setBusy(true);
    setMsg("");
    try {
      await api<unknown>("/api/compendium", { method: "DELETE" });
      setMsg("Compendium deleted.");
      await api<unknown>("/api/meta");
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0, overflow: "auto" }}>
      <Panel
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconCompendiumAlt size={36} title="Compendium" />
            <span>Compendium import (XML)</span>
          </span>
        }
      >
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
          Upload a Fight Club–style compendium XML. The server stores it in a local database. Re-importing an entry with the same name (case-insensitive, ignoring trailing
          <code>[...]</code>) will replace the existing entry.
          <br />
          <code>
            I recommend:{" "}
            <a target="_blank" rel="noopener noreferrer" href="https://github.com/vidalvanbergen/FightClub5eXML">
              Vianna's Compendium
            </a>
          </code>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ color: theme.colors.text }}
          />
          <Button onClick={uploadCompendium} disabled={!file || busy}>
            {busy ? "Importing…" : "Import XML"}
          </Button>
          <Button variant="ghost" onClick={deleteCompendium} disabled={busy}>
            Delete Compendium
          </Button>
        </div>

        {msg ? (
          <div style={{ marginTop: 12, color: msg.toLowerCase().includes("fail") ? theme.colors.red : theme.colors.text }}>{msg}</div>
        ) : null}

        {lastImport && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 14px", color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            {lastImport.imported > 0 && <span>🐉 {lastImport.imported} monsters</span>}
            {(lastImport.classes ?? 0) > 0 && <span>⚔️ {lastImport.classes} classes</span>}
            {(lastImport.races ?? 0) > 0 && <span>🧝 {lastImport.races} species</span>}
            {(lastImport.backgrounds ?? 0) > 0 && <span>📜 {lastImport.backgrounds} backgrounds</span>}
            {(lastImport.feats ?? 0) > 0 && <span>✨ {lastImport.feats} feats</span>}
          </div>
        )}
      </Panel>
    </div>
  );
}
