import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  AlertIcon,
  PrimaryButton,
  SecondaryButton,
  TopBar,
  tokens,
  withGroupBreaks,
  type PrimaryButtonProps,
} from "@balotachain/ui";
import { visibleHeight } from "./useKeyboardOpen";

export type Direction = "fwd" | "back";

/**
 * The voting software build on this phone (the WebAssembly crypto's version
 * line) and the election key's fingerprint, shown small at the foot of every
 * screen once known, so anyone can see which build a phone runs.
 */
export interface AboutLine {
  software: string | null;
  keyFingerprint: string | null;
}
export const AboutContext = createContext<AboutLine>({
  software: null,
  keyFingerprint: null,
});

function About() {
  const { software, keyFingerprint } = useContext(AboutContext);
  if (!software && !keyFingerprint) return null;
  return (
    <footer
      className="ba-about"
      aria-label="About this phone's voting software"
    >
      {software ? <div>Voting software: {software}</div> : null}
      {keyFingerprint ? (
        <div>
          Election key:{" "}
          {/* m8: a wrapped key breaks between its groups only. */}
          <span className="bc-mono">{withGroupBreaks(keyFingerprint)}</span>
        </div>
      ) : null}
    </footer>
  );
}

/**
 * Whether this page runs a practice election: `true` for the mock, `"local"`
 * for the local test election, `false` for the real one.
 */
export const PracticeContext = createContext<boolean | "local">(false);

/**
 * A strip pinned to the top of every screen while the page runs a practice
 * election, so no screen (least of all "Ballot recorded") can pass for the
 * real thing. Warning tint and warning text, per DESIGN.md.
 */
function PracticeBanner() {
  const practice = useContext(PracticeContext);
  if (!practice) return null;
  return (
    <div
      className="ba-practice"
      role="note"
      aria-label="Practice election"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        gap: 8,
        alignItems: "center",
        // Padding, with the top safe-area inset: `.ba-practice` (vote.css).
        background: tokens.color.warnLight,
        borderBottom: `1px solid ${tokens.color.warnBorder}`,
        color: tokens.color.warnText,
        fontSize: "var(--ba-type-small)",
        lineHeight: 1.4,
      }}
    >
      <span
        style={{ color: tokens.color.warn, display: "inline-flex" }}
        aria-hidden
      >
        <AlertIcon size={18} />
      </span>
      <span>
        <strong>Practice election.</strong>{" "}
        {practice === "local"
          ? "Throwaway test keys. Nothing is sent or recorded."
          : "Nothing you do here is sent or recorded."}
      </span>
    </div>
  );
}

/**
 * True while the screen being shown came by itself (the ballot opening after
 * the credential is stored, the waiting screen giving way): the new screen
 * then focuses its heading, so a screen reader announces it (5c-1 review,
 * m7). Set by App with the route.
 */
export const AutoAdvanceContext = createContext(false);

/**
 * The most of the visible height a pinned footer may take (M1). Above it,
 * the footer joins the page flow instead of covering the screen.
 */
export const FOOTER_MAX_SHARE = 0.4;

/** M1: whether a footer this tall joins the flow at this visible height. */
export function footerJoinsFlow(footerPx: number, visiblePx: number): boolean {
  return visiblePx > 0 && footerPx > FOOTER_MAX_SHARE * visiblePx;
}

/** One phone screen: bar, scrolling body, pinned footer. */
export function Screen({
  title,
  back,
  direction = "fwd",
  footer,
  footerDense = false,
  children,
}: {
  title: string;
  back?: () => void;
  direction?: Direction;
  footer?: ReactNode;
  /** Three actions in the footer: smaller gaps from the spacing scale. */
  footerDense?: boolean;
  children: ReactNode;
}) {
  const auto = useContext(AutoAdvanceContext);
  // Each route mounts a new Screen. Move focus to its content so a screen
  // reader user hears the new screen instead of staying on the control that
  // was just pressed (and is now gone).
  // A layout effect, not a passive one: focus moves in the same commit that
  // shows the screen, so no frame (and no observer of the DOM) sees the new
  // screen with focus still on the page body. A passive effect runs later,
  // on React's scheduler task, which is what made the focus check in
  // App.test.tsx fail about 1 run in 10.
  // m7: a screen that came by itself focuses its heading instead (`ba-heading`,
  // tabIndex -1), so a screen reader reads out the new screen.
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const heading = auto
      ? main.current?.querySelector<HTMLElement>(".ba-heading")
      : null;
    (heading ?? main.current)?.focus({ preventScroll: true });
    // Once, for the screen as it mounts.
  }, []);

  // D20: the pinned footer's height, measured (it holds one to three
  // actions and the 10 s line), so the page scrolls a field or a row into
  // view above it, never under it (`scroll-padding-bottom`, vote.css).
  // M1 (5c-2 review): a footer taller than FOOTER_MAX_SHARE of what the
  // reader can see (large text on a short phone) joins the page flow
  // (`data-flow="tall"`); it pins again once it fits.
  //
  // Stable by construction: the footer's height does not depend on whether
  // it is pinned (same width, same padding; `position` moves it, it does not
  // resize it), and the visible height does not depend on the footer, so
  // joining the flow never changes either input of the rule. The attribute
  // is written only when the answer changes.
  const foot = useRef<HTMLDivElement>(null);
  const hasFooter = Boolean(footer);
  useEffect(() => {
    const root = document.documentElement;
    const el = foot.current;
    if (!el) {
      root.style.setProperty("--ba-footer-h", "0px");
      return;
    }
    const decide = () => {
      const h = el.offsetHeight;
      const tall = footerJoinsFlow(h, visibleHeight());
      if ((el.dataset.flow === "tall") !== tall) {
        if (tall) el.dataset.flow = "tall";
        else delete el.dataset.flow;
      }
      // In the flow the footer covers nothing: no scroll padding for it.
      root.style.setProperty("--ba-footer-h", tall ? "0px" : `${h}px`);
    };
    decide();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", decide);
    window.addEventListener("resize", decide);
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(decide);
    ro?.observe(el);
    return () => {
      vv?.removeEventListener("resize", decide);
      window.removeEventListener("resize", decide);
      ro?.disconnect();
    };
  }, [hasFooter]);

  // M5 (5c-2 review): the sticky practice strip's measured height, so a
  // focused row is never scrolled under it (`scroll-padding-top`); 0 when
  // there is no strip.
  const screenEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const banner = screenEl.current?.querySelector<HTMLElement>(".ba-practice");
    if (!banner) {
      root.style.setProperty("--ba-banner-h", "0px");
      return;
    }
    const set = () =>
      root.style.setProperty("--ba-banner-h", `${banner.offsetHeight}px`);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(banner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={screenEl} className={`ba-screen ba-screen-${direction}`}>
      <PracticeBanner />
      <div className="ba-topbar">
        <TopBar
          title={title}
          // D20: a long position title wraps, the bar grows; never cut.
          wrapTitle
          back={back}
        />
      </div>
      <main ref={main} className="ba-body" tabIndex={-1} aria-label={title}>
        {children}
        <About />
      </main>
      {footer ? (
        <div
          ref={foot}
          className={footerDense ? "ba-footer ba-footer-dense" : "ba-footer"}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Heading plus one line of lead text at the top of a body. */
export function Lead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: tokens.space.md }}>
      <h2 className="ba-title ba-heading" tabIndex={-1}>
        {title}
      </h2>
      {children ? <p className="ba-lead">{children}</p> : null}
    </div>
  );
}

/** Section label: 13px, 600, tracked, uppercase. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <span
      className="bc-label"
      style={{ display: "block", color: tokens.color.text2 }}
    >
      {children}
    </span>
  );
}

/**
 * A footer button across the column. A label that wraps (a narrow phone, a
 * large text setting) gets room between its lines; one line draws as before.
 */
export const FULL_WIDTH = { width: "100%", lineHeight: 1.2 } as const;

/**
 * The primary action. While `busy`, it keeps its width and swaps the label
 * for a spinner plus the in-flight word (DESIGN.md, Button).
 */
export function ActionButton({
  busy = false,
  busyLabel,
  children,
  disabled,
  ...rest
}: PrimaryButtonProps & { busy?: boolean; busyLabel?: string }) {
  return (
    <PrimaryButton
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      style={FULL_WIDTH}
    >
      {busy ? (
        <>
          <span className="ba-spinner" aria-hidden />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </PrimaryButton>
  );
}

export function SecondaryAction({
  busy = false,
  busyLabel,
  children,
  disabled,
  ...rest
}: PrimaryButtonProps & { busy?: boolean; busyLabel?: string }) {
  return (
    <SecondaryButton
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      style={{ ...FULL_WIDTH, gap: 10 }}
    >
      {busy ? (
        <>
          <span className="ba-spinner" aria-hidden />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </SecondaryButton>
  );
}

/** D9: the one line under a write's button once it has run for 10 s. */
export const STILL_RECORDING = "Still recording. Keep this page open.";

/** The quiet line under a busy button (D9). `show` comes from `useSlow`. */
export function SlowNote({ show }: { show: boolean }) {
  // Always rendered, so the polite region exists before its text arrives;
  // empty, it is visually hidden and takes no room in the footer.
  return (
    <p
      aria-live="polite"
      className={show ? "ba-slow" : "ba-slow bc-sr-only"}
      style={{
        margin: 0,
        textAlign: "center",
        fontSize: "var(--ba-type-small)",
        color: tokens.color.text2,
      }}
    >
      {show ? STILL_RECORDING : ""}
    </p>
  );
}

type Tone = "warning" | "error" | "success" | "neutral";

const tones: Record<
  Tone,
  { bg: string; border: string; fg: string; icon: string }
> = {
  warning: {
    bg: tokens.color.warnLight,
    border: tokens.color.warnBorder,
    fg: tokens.color.warnText,
    icon: tokens.color.warn,
  },
  error: {
    bg: tokens.color.errorLight,
    border: tokens.color.errorLight,
    fg: tokens.color.error,
    icon: tokens.color.error,
  },
  success: {
    bg: tokens.color.successLight,
    border: tokens.color.successBorder,
    fg: tokens.color.successText,
    icon: tokens.color.success,
  },
  neutral: {
    bg: tokens.color.neutralFill,
    border: tokens.color.border,
    fg: tokens.color.text2,
    icon: tokens.color.text2,
  },
};

/** An inline message block. Errors are announced (`role="alert"`). */
export function Notice({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: tokens.radius.button,
        padding: "14px 16px",
        color: t.fg,
        fontSize: "var(--ba-type-note)",
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: t.icon, flexShrink: 0, display: "inline-flex" }}>
        {icon ?? <AlertIcon size={22} />}
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** A tinted square holding a large glyph, as on the mockup's onboarding. */
export function Emblem({
  children,
  tone = "teal",
  pop = false,
}: {
  children: ReactNode;
  tone?: "teal" | "success" | "warning" | "error";
  pop?: boolean;
}) {
  const palette = {
    teal: [tokens.color.tealLight, tokens.color.teal],
    success: [tokens.color.successLight, tokens.color.success],
    warning: [tokens.color.warnLight, tokens.color.warn],
    error: [tokens.color.errorLight, tokens.color.error],
  }[tone];
  return (
    <div
      aria-hidden
      className={pop ? "ba-pop" : undefined}
      style={{
        width: 72,
        height: 72,
        borderRadius: 22,
        marginBottom: tokens.space.md,
        background: palette[0],
        color: palette[1],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

/** A labelled field; the label is tied to its input by `id`. */
export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: "var(--ba-type-detail)",
          fontWeight: 600,
          color: tokens.color.text2,
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
