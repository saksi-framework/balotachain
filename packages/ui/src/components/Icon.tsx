import { forwardRef, type SVGAttributes } from "react";

export type IconProps = SVGAttributes<SVGSVGElement> & {
  size?: number;
};

type GlyphProps = Omit<IconProps, "children">;

const Base = forwardRef<
  SVGSVGElement,
  IconProps & { children: React.ReactNode }
>(function Base({ size = 20, children, ...rest }, ref) {
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
});

export const LockIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function LockIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <rect x="4" y="9" width="12" height="8" rx="2" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      </Base>
    );
  },
);

export const ShieldCheckIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function ShieldCheckIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="M10 2.5 3.5 5v4.5c0 4 2.8 6.8 6.5 8 3.7-1.2 6.5-4 6.5-8V5L10 2.5Z" />
        <path d="m7.5 10 1.8 1.8L13 8" />
      </Base>
    );
  },
);

export const GlobeIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function GlobeIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15" />
        <path d="M10 2.5c2 2.4 3 5.1 3 7.5s-1 5.1-3 7.5c-2-2.4-3-5.1-3-7.5s1-5.1 3-7.5Z" />
      </Base>
    );
  },
);

export const CheckIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function CheckIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="m4 10.5 4 4 8-9" />
      </Base>
    );
  },
);

export const CopyIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function CopyIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <rect x="6" y="6" width="11" height="11" rx="2" />
        <path d="M14 6V4.5A1.5 1.5 0 0 0 12.5 3H4.5A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H6" />
      </Base>
    );
  },
);

export const BackIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function BackIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="M12.5 4 6.5 10l6 6" />
      </Base>
    );
  },
);

export const ChevronIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function ChevronIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="m7.5 4 6 6-6 6" />
      </Base>
    );
  },
);

export const ClockIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function ClockIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6v4.2l2.8 1.8" />
      </Base>
    );
  },
);

/** Circled exclamation — matches the mockups' warning glyph. */
export const AlertIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function AlertIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6v4.5" />
        <circle cx="10" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
      </Base>
    );
  },
);

/** Two people — the trustee-threshold glyph on the auditor crypto panel. */
export const UsersIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function UsersIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <circle cx="7.5" cy="6.5" r="2.7" />
        <path d="M3 16c0-2.5 2-4.2 4.5-4.2S12 13.5 12 16" />
        <path d="M13.3 5.2a2.5 2.5 0 0 1 0 5M15 16c0-1.8-1-3.3-2.5-3.8" />
      </Base>
    );
  },
);

/** Hash / fingerprint glyph. */
export const HashIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function HashIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="M7.5 3.3 6 16.7M14.2 3.3l-1.7 13.4M3.3 7.5h13.4M2.5 12.5h13.4" />
      </Base>
    );
  },
);

/** Download arrow onto a baseline. */
export const DownloadIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function DownloadIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="M10 3.3v9.2m0 0-3.3-3.3M10 12.5l3.3-3.3" />
        <path d="M4.2 15.8h11.6" />
      </Base>
    );
  },
);

/** Angle brackets — "open verifier" / source-code glyph. */
export const CodeIcon = forwardRef<SVGSVGElement, GlyphProps>(
  function CodeIcon(props, ref) {
    return (
      <Base ref={ref} {...props}>
        <path d="M6.7 5 2.5 10l4.2 5M13.3 5l4.2 5-4.2 5" />
      </Base>
    );
  },
);
