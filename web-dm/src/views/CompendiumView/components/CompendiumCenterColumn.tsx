import { RulesReferencePanel } from "@/views/CompendiumView/panels/RulesReferencePanel";
import { CompendiumAdminPanel } from "@/views/CompendiumView/panels/CompendiumAdminPanel";
import { AdversaryBrowserPanel } from "@/views/CompendiumView/panels/AdversaryBrowserPanel";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";

export function CompendiumCenterColumn(props: {
  activeSection: CompendiumSection;
  selectedAdversaryId: string | null;
  onSelectAdversary: (id: string) => void;
}) {
  return (
    <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {props.activeSection === "adversaries" && (
        <AdversaryBrowserPanel
          selectedAdversaryId={props.selectedAdversaryId}
          onSelect={props.onSelectAdversary}
        />
      )}
      {props.activeSection === "rules" && <RulesReferencePanel />}
      {props.activeSection === "admin" && <CompendiumAdminPanel />}
    </div>
  );
}
