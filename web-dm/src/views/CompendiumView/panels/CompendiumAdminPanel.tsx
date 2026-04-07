import React from "react";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconCompendiumAlt } from "@/icons";
import { theme } from "@/theme/theme";
import { api, jsonInit } from "@/services/api";

interface ImportResult {
  ok: boolean;
  imported: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = await api<ImportResult>("/api/compendium/adversaries/import", jsonInit("POST", parsed));
      setLastImport(result);
      setMsg("Imported.");
    } catch (error: unknown) {
      setMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0, overflow: "auto" }}>
      <Panel
        storageKey="compendium-admin-import"
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconCompendiumAlt size={36} title="Compendium" />
            <span>Compendium Import (JSON)</span>
          </span>
        }
      >
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
          Upload a Stormlight adversary JSON file to populate the compendium.
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ color: theme.colors.text }}
          />
          <Button onClick={uploadCompendium} disabled={!file || busy}>
            {busy ? "Importing..." : "Import JSON"}
          </Button>
        </div>

        {msg ? (
          <div style={{ marginTop: 12, color: msg.toLowerCase().includes("fail") ? theme.colors.red : theme.colors.text }}>{msg}</div>
        ) : null}

        {lastImport && (
          <div style={{ marginTop: 8, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            Adversaries: {lastImport.imported}
          </div>
        )}
      </Panel>
    </div>
  );
}
