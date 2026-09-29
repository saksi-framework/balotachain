// balota-components.jsx — BalotaChain reusable UI primitives
// All tokens come from CSS vars defined in the host HTML.

// ───────────────────────── Icons (simple, clean line glyphs) ─────────────────────────
const I = {
  lock: (s = 30, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke={c} strokeWidth="1.6"/>
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="12" cy="15" r="1.6" fill={c}/>
      <path d="M12 16.4v1.6" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  shieldCheck: (s = 30, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 2.6v5.2c0 4.6-3 8-7 9.4-4-1.4-7-4.8-7-9.4V5.6L12 3z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M8.6 12l2.3 2.4 4.5-4.8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  globe: (s = 30, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.6"/>
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5S14.4 18.2 12 20.5C9.6 18.2 8.4 15.2 8.4 12S9.6 5.8 12 3.5z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  check: (s = 30, c = 'currentColor', w = 2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  copy: (s = 20, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" stroke={c} strokeWidth="1.7"/>
      <path d="M5.5 15.5A2 2 0 0 1 4 13.6V6a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.9 1.5" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  back: (s = 24, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chevron: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M9 5l7 7-7 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  clock: (s = 17, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.6"/>
      <path d="M12 7.5V12l3 1.8" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  alert: (s = 22, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.7"/>
      <path d="M12 7.5V13" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="12" cy="16.2" r="1.05" fill={c}/>
    </svg>
  ),
};

// ───────────────────────── Buttons ─────────────────────────
function PrimaryButton({ children, onClick, disabled = false, style = {} }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: '100%', minHeight: 56, border: 'none', cursor: disabled ? 'default' : 'pointer',
        borderRadius: 9999, background: disabled ? 'var(--disabled)' : 'var(--teal)',
        color: disabled ? 'var(--text-2)' : '#fff', fontSize: 18, fontWeight: 600,
        fontFamily: 'inherit', letterSpacing: 0.1,
        transition: 'background .18s, transform .12s, box-shadow .18s',
        boxShadow: disabled ? 'none' : '0 6px 16px -6px rgba(15,110,110,0.5)',
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.978)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', minHeight: 56, cursor: 'pointer',
        borderRadius: 12, background: 'transparent',
        border: '1.5px solid var(--teal)', color: 'var(--teal)',
        fontSize: 18, fontWeight: 600, fontFamily: 'inherit', letterSpacing: 0.1,
        transition: 'background .15s, transform .12s',
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.978)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  );
}

function TextButton({ children, onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--teal)', fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
      padding: '8px 4px', ...style,
    }}>{children}</button>
  );
}

// ───────────────────────── Option card (selectable) ─────────────────────────
function OptionCard({ name, role, initials, selected, onClick, multi = false, disabled = false }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', display: 'flex',
        alignItems: 'center', gap: 14, padding: '16px 16px',
        borderRadius: 'var(--r-card)', fontFamily: 'inherit',
        background: selected ? 'var(--teal-light)' : 'var(--surface)',
        border: selected ? '2px solid var(--teal)' : '1.5px solid var(--border)',
        boxShadow: selected ? 'none' : '0 1px 2px rgba(26,37,38,0.04)',
        opacity: disabled ? 0.42 : 1,
        transition: 'background .16s, border-color .16s, opacity .16s',
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, fontWeight: 600,
        background: selected ? 'var(--teal)' : '#EEF1F0',
        color: selected ? '#fff' : 'var(--text-2)',
        transition: 'background .16s, color .16s',
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>{name}</div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{role}</div>
      </div>
      <div style={{
        width: 26, height: 26, borderRadius: multi ? 8 : 9999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? 'var(--teal)' : 'transparent',
        border: selected ? 'none' : '2px solid var(--border)',
        transition: 'background .16s',
      }}>
        {selected && I.check(16, '#fff', 2.6)}
      </div>
    </button>
  );
}

// ───────────────────────── Text input ─────────────────────────
function TextInput({ label, placeholder, value, onChange, helper, mono = false, onFocus }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ width: '100%' }}>
      {label && <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => { setFocus(true); onFocus && onFocus(); }}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%', boxSizing: 'border-box', minHeight: 56, padding: '0 16px',
          borderRadius: 12, fontFamily: mono ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'inherit',
          fontSize: mono ? 18 : 16, fontWeight: mono ? 600 : 400, letterSpacing: mono ? 1 : 0,
          color: 'var(--text-1)', background: 'var(--surface)', outline: 'none',
          border: focus ? '2px solid var(--teal)' : '1.5px solid var(--border)',
          transition: 'border-color .15s',
        }}
      />
      {helper && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5 }}>{helper}</div>}
    </div>
  );
}

// ───────────────────────── Top app bar ─────────────────────────
function TopBar({ title, onBack, trailing }) {
  return (
    <div style={{
      paddingTop: 58, paddingBottom: 12, paddingLeft: 8, paddingRight: 16,
      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
      background: 'var(--bg)',
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-1)',
          flexShrink: 0,
        }}>{I.back(24)}</button>
      ) : <div style={{ width: 16, flexShrink: 0 }} />}
      <div style={{ flex: 1, fontSize: 20, fontWeight: 700, color: 'var(--text-1)', letterSpacing: 0.1 }}>{title}</div>
      {trailing}
    </div>
  );
}

// ───────────────────────── Page dots ─────────────────────────
function PageDots({ count, active }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 8, borderRadius: 9999,
          width: i === active ? 22 : 8,
          background: i === active ? 'var(--teal)' : 'var(--border)',
          transition: 'width .25s, background .25s',
        }} />
      ))}
    </div>
  );
}

Object.assign(window, {
  BIcons: I, PrimaryButton, SecondaryButton, TextButton, OptionCard, TextInput, TopBar, PageDots,
});
