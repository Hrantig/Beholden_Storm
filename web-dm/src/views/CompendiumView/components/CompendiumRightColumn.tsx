import { AdversaryDetailPanel } from "@/views/CompendiumView/panels/AdversaryDetailPanel";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";

export function CompendiumRightColumn(props: {
  activeSection: CompendiumSection;
  selectedAdversaryId: string | null;
}) {
  if (props.activeSection === "adversaries") {
    return (
      <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AdversaryDetailPanel adversaryId={props.selectedAdversaryId} />
      </div>
    );
  }

  return null;
}
