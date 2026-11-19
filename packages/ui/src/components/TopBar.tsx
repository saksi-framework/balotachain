import { type CSSProperties, type ReactNode } from "react";
import { tokens } from "../tokens.js";
import { BackIcon, ShieldCheckIcon } from "./Icon.js";

/** Compact centred-title bar with an optional back button. */
export type CompactTopBarProps = {
  title: string;
  back?: () => void;
  right?: ReactNode;
  /**
   * Let a long title wrap onto more lines (the bar grows) instead of being
   * cut with an ellipsis. Off by default; the voting page opts in (D20).
   */
  wrapTitle?: boolean;
};

/** Desktop console bar shared by admin, trustee and the bulletin board. */
export type ConsoleTopBarProps = {
  /**
   * e.g. "Trustee Console"; shown after the BalotaChain mark. An empty string
   * shows the mark alone (the live trustee screen, as drawn in D5).
   */
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
            <h1
              style={{
                display: "block",
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                lineHeight: "inherit",
              }}
            >
              BalotaChain
              {appName ? (
                <>
                  {" "}
                  <span style={{ color: tokens.color.text2, fontWeight: 500 }}>
                    — {appName}
                  </span>
                </>
              ) : null}
            </h1>
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

function CompactBar({
  title,
  back,
  right,
  wrapTitle = false,
}: CompactTopBarProps) {
  const bar: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.space.sm,
    // Wrapping: at least the drawn 56px, taller as the title needs. When
    // the title would get narrower than 8em (large text on a small phone),
    // the right-hand slot moves under it instead.
    ...(wrapTitle
      ? {
          minHeight: 56,
          // 6px keeps a one-line bar at the drawn 56px with the 40px Back.
          padding: `6px ${tokens.space.sm}px`,
          flexWrap: "wrap",
          rowGap: 0,
        }
      : { height: 56, padding: `0 ${tokens.space.sm}px` }),
    background: tokens.color.surface,
    borderBottom: `1px solid ${tokens.color.border}`,
  };

  const slot: CSSProperties = {
    display: "flex",
    alignItems: "center",
    minWidth: 40,
  };

  // D17: a 44 by 44 hit area. The -2px margin keeps the drawn 40px
  // footprint, so the title and the slots do not move.
  const backBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    margin: -2,
    border: "none",
    background: "transparent",
    color: tokens.color.text1,
    borderRadius: tokens.radius.button,
    cursor: "pointer",
  };

  const titleStyle: CSSProperties = {
    textAlign: "center",
    fontSize: tokens.font.body,
    fontWeight: 600,
    color: tokens.color.text1,
    lineHeight: tokens.type.lineHeight,
    ...(wrapTitle
      ? // Never cut (D20); a long word with no hyphen breaks as a last resort.
        { flex: "1 1 8em", margin: 0, overflowWrap: "anywhere", minWidth: 0 }
      : {
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }),
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
      <div style={{ ...slot, justifyContent: "flex-end", marginLeft: "auto" }}>
        {right}
      </div>
    </header>
  );
}
