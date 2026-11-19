import { OptionCard, tokens } from "@balotachain/ui";
import { ActionButton, Screen, type Direction } from "../components/Layout";
import type { Position } from "../lib/live";

export function Ballot({
  positions,
  index,
  selected,
  editing,
  direction,
  onPick,
  onBack,
  onNext,
}: {
  positions: Position[];
  index: number;
  /** candidateId chosen for this position, if any. */
  selected: string | undefined;
  /** Opened from Review's Edit link: Next returns to Review. */
  editing: boolean;
  direction: Direction;
  onPick: (candidateId: string) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const position = positions[index]!;
  const last = index === positions.length - 1;
  const headingId = `pos-${position.id}`;

  return (
    <Screen
      key={position.id}
      title={position.title}
      back={onBack}
      direction={direction}
      footer={
        <ActionButton disabled={!selected} onClick={onNext}>
          {editing ? "Back to review" : last ? "Review" : "Next"}
        </ActionButton>
      }
    >
      <div style={{ marginBottom: tokens.space.sm }}>
        <div aria-hidden style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {positions.map((p, i) => (
            <span
              key={p.id}
              style={{
                flex: 1,
                height: 5,
                borderRadius: tokens.radius.pill,
                background:
                  i <= index ? tokens.color.teal : tokens.color.border,
                transition: "background 200ms",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <span className="bc-label" style={{ color: tokens.color.text2 }}>
            Position {index + 1} of {positions.length}
          </span>
          <span
            style={{
              fontSize: "var(--ba-type-small)",
              fontWeight: 600,
              color: tokens.color.text2,
            }}
          >
            Choose one
          </span>
        </div>
      </div>

      <h2 id={headingId} className="bc-sr-only ba-heading" tabIndex={-1}>
        {position.title}: choose one
      </h2>
      <div role="radiogroup" aria-labelledby={headingId} className="ba-stack">
        {position.candidates.map((c) => (
          <OptionCard
            key={c.id}
            label={c.name}
            description={c.detail}
            selected={selected === c.id}
            onSelect={() => onPick(c.id)}
          />
        ))}
      </div>
    </Screen>
  );
}
