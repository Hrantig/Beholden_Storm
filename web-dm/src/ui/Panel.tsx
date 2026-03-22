import React from "react";
import { theme } from "@/theme/theme";
import { SectionTitle } from "@/ui/SectionTitle";

export function Panel(props: {
  title: React.ReactNode;
  titleColor?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: theme.radius.panel,
        padding: "8px 10px",
        background: theme.colors.panelBg,
        ...props.style,
      }}
    >
      <SectionTitle color={props.titleColor} actions={props.actions}>
        {props.title}
      </SectionTitle>
      <div style={{ ...props.bodyStyle }}>{props.children}</div>
    </div>
  );
}
