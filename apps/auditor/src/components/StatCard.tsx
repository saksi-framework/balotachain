import type { ReactNode } from "react";
import { Card, tokens } from "@balotachain/ui";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  caption: string;
  /** Renders the number in success green, as on the "Verified" tile. */
  ok?: boolean;
  /** Small glyph shown before the label. */
  icon?: ReactNode;
};

export function StatCard({ label, value, caption, ok, icon }: StatCardProps) {
  return (
    <Card style={{ padding: "20px 22px", minWidth: 0 }}>
      <div
        style={{
          fontSize: tokens.type.small,
          color: tokens.color.text2,
          fontWeight: 500,
          marginBottom: 9,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: -0.4,
          lineHeight: 1,
          color: ok ? tokens.color.success : tokens.color.text1,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: tokens.color.text2, marginTop: 7 }}>
        {caption}
      </div>
    </Card>
  );
}
