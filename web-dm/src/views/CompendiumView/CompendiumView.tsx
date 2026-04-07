import React from "react";
import { CompendiumLeftColumn } from "@/views/CompendiumView/components/CompendiumLeftColumn";
import { CompendiumCenterColumn } from "@/views/CompendiumView/components/CompendiumCenterColumn";
import { CompendiumRightColumn } from "@/views/CompendiumView/components/CompendiumRightColumn";

export type CompendiumSection = "adversaries" | "rules" | "admin";

export function CompendiumView() {
  const [activeSection, setActiveSection] = React.useState<CompendiumSection>("adversaries");
  const [selectedAdversaryId, setSelectedAdversaryId] = React.useState<string | null>(null);

  const handleSetSection = React.useCallback((s: CompendiumSection) => {
    setActiveSection(s);
    setSelectedAdversaryId(null);
  }, []);

  const hasRightColumn = activeSection === "adversaries";

  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: hasRightColumn ? "15% 35% 1fr" : "15% 1fr",
          gridTemplateRows: "1fr",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <CompendiumLeftColumn
          activeSection={activeSection}
          onSetSection={handleSetSection}
        />
        <CompendiumCenterColumn
          activeSection={activeSection}
          selectedAdversaryId={selectedAdversaryId}
          onSelectAdversary={setSelectedAdversaryId}
        />
        {hasRightColumn && (
          <CompendiumRightColumn
            activeSection={activeSection}
            selectedAdversaryId={selectedAdversaryId}
          />
        )}
      </div>
    </div>
  );
}
