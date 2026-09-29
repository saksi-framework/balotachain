import { type CSSProperties, type ReactNode } from "react";
import { tokens } from "../tokens.js";
import { BackIcon, ShieldCheckIcon } from "./Icon.js";

/** Compact centred-title bar with an optional back button. */
export type CompactTopBarProps = {
  title: string;
  back?: () => void;
  right?: ReactNode;
};

/** Desktop console bar shared by admin, trustee and the bulletin board. */
export type ConsoleTopBarProps = {
  /** e.g. "Trustee Console"; shown after the BalotaChain mark. */
  appName: string;
  /** The election being viewed, when there is one. */
  electionName?: ReactNode;
  /** Right-hand slot: the signed-in role, a run picker, a status chip. */
  role?: ReactNode;
};

export type TopBarProps = CompactTopBarProps | ConsoleTopBarProps;

export function TopBar(props: TopBarProps) {
  return "appName" in props ? (
    <ConsoleBar {...props} />
  ) : (
    <CompactBar {...props} />
  );
}

function ConsoleBar({ appName, electionName, role }: ConsoleTopBarProps) {
  return (
    <header
      style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        className="bc-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: `${tokens.space.xs}px ${tokens.space.sm}px`,
          minHeight: 64,
          paddingTop: tokens.space.xs,
          paddingBottom: tokens.space.xs,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            minWidth: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: tokens.color.teal,
              color: tokens.color.surface,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheckIcon size={20} strokeWidth={1.7} />
          </span>
          <span style={{ lineHeight: 1.25, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>
              BalotaChain{" "}
              <span style={{ color: tokens.color.text2, fontWeight: 500 }}>
                — {appName}
              </span>
            </span>
            {electionName ? (
              <span
                style={{
                  display: "block",
                  fontSize: tokens.type.small,
                  color: tokens.color.text2,
                  overflowWrap: "anywhere",
                }}
              >
                {electionName}
              </span>
            ) : null}
          </span>
        </span>
        {role ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {role}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function CompactBar({ title, back, right }: CompactTopBarProps) {
  const bar: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
    height: 56,
    padding: `0 ${tokens.space.sm}px`,
    background: tokens.color.surface,
    borderBottom: `1px solid ${tokens.color.border}`,
  };

  const slot: CSSProperties = {
    display: "flex",
    alignItems: "center",
    minWidth: 40,
  };

  const backBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    border: "none",
    background: "transparent",
    color: tokens.color.text1,
    borderRadius: tokens.radius.button,
    cursor: "pointer",
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    textAlign: "center",
    fontSize: tokens.type.body,
    fontWeight: 600,
    color: tokens.color.text1,
    lineHeight: tokens.type.lineHeight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <header style={bar}>
      <div style={slot}>
        {back ? (
          <button
            type="button"
            aria-label="Back"
            onClick={back}
            style={backBtn}
          >
            <BackIcon />
          </button>
        ) : null}
      </div>
      <h1 style={titleStyle}>{title}</h1>
      <div style={{ ...slot, justifyContent: "flex-end" }}>{right}</div>
    </header>
  );
}
