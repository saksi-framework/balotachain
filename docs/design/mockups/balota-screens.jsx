// balota-screens.jsx — BalotaChain 8 screens
const { BIcons, PrimaryButton, SecondaryButton, TextButton, OptionCard, TextInput, TopBar, PageDots } = window;

const RACES = [
  {
    key: 'president', label: 'President', pick: 1,
    candidates: [
      { id: 'p-reyes',     name: 'Andrea Reyes',      role: 'Lakas ng Bayan',     initials: 'AR' },
      { id: 'p-villa',     name: 'Marco Villanueva',  role: 'Tatak Galing Party', initials: 'MV' },
      { id: 'p-santos',    name: 'Joy delos Santos',  role: 'Bagong Pilipinas',   initials: 'JD' },
      { id: 'p-hassan',    name: 'Rashid Hassan',     role: 'Independent',        initials: 'RH' },
    ],
  },
  {
    key: 'vp', label: 'Vice President', pick: 1,
    candidates: [
      { id: 'v-aquino',    name: 'Camille Aquino',    role: 'Lakas ng Bayan',     initials: 'CA' },
      { id: 'v-torres',    name: 'Benigno Torres',    role: 'Tatak Galing Party', initials: 'BT' },
      { id: 'v-mangahas',  name: 'Liza Mangahas',     role: 'Bagong Pilipinas',   initials: 'LM' },
      { id: 'v-pangi',     name: 'Omar Pangilinan',   role: 'Independent',        initials: 'OP' },
    ],
  },
  {
    key: 'senators', label: 'Senators', pick: 12,
    candidates: [
      { id: 's-bautista',  name: 'Grace Bautista',        role: 'Lakas ng Bayan',     initials: 'GB' },
      { id: 's-cuevas',    name: 'Ramon Cuevas',          role: 'Tatak Galing Party', initials: 'RC' },
      { id: 's-navarro',   name: 'Isabel Navarro',        role: 'Independent',        initials: 'IN' },
      { id: 's-lim',       name: 'Teodoro Lim',           role: 'Bagong Pilipinas',   initials: 'TL' },
      { id: 's-macaraeg',  name: 'Farida Macaraeg',       role: 'Lakas ng Bayan',     initials: 'FM' },
      { id: 's-ocampo',    name: 'Vicente Ocampo',        role: 'Independent',        initials: 'VO' },
      { id: 's-salazar',   name: 'Dolores Salazar',       role: 'Tatak Galing Party', initials: 'DS' },
      { id: 's-aguilar',   name: 'Nestor Aguilar',        role: 'Bagong Pilipinas',   initials: 'NA' },
      { id: 's-fuentes',   name: 'Pilar Fuentes',         role: 'Independent',        initials: 'PF' },
      { id: 's-dimaano',   name: 'Ernesto Dimaano',       role: 'Lakas ng Bayan',     initials: 'ED' },
      { id: 's-lacson',    name: 'Cherry Mae Lacson',     role: 'Tatak Galing Party', initials: 'CL' },
      { id: 's-rivera',    name: 'Alfonso Rivera',        role: 'Independent',        initials: 'AR' },
      { id: 's-yap',       name: 'Maria Concepcion Yap',  role: 'Bagong Pilipinas',   initials: 'MY' },
      { id: 's-pangani',   name: 'Gregorio Panganiban',   role: 'Lakas ng Bayan',     initials: 'GP' },
    ],
  },
];
const ALL = {};
RACES.forEach((r) => r.candidates.forEach((c) => { ALL[c.id] = { ...c, race: r.key }; }));
const TRACKING_CODE = 'BC-7F3A-92K1';
window.RACES = RACES;
window.ALL = ALL;
window.TRACKING_CODE = TRACKING_CODE;

// shared scroll body
function Body({ children, style = {}, pad = 24 }) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: `0 ${pad}px`, ...style,
    }}>{children}</div>
  );
}
// pinned footer that clears the home indicator
function Footer({ children }) {
  return (
    <div style={{ flexShrink: 0, padding: '14px 24px 30px', background: 'var(--bg)' }}>{children}</div>
  );
}

// ───────────────────────── 1. Splash ─────────────────────────
function SplashScreen({ nav }) {
  React.useEffect(() => {
    const t = setTimeout(() => nav('onboarding'), 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div onClick={() => nav('onboarding')} style={{
      height: '100%', background: 'var(--teal-dark)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', position: 'relative',
    }}>
      <div className="ba-pop" style={{
        width: 76, height: 76, borderRadius: 22, marginBottom: 26,
        background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>{BIcons.shieldCheck(40, '#fff')}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 0.2 }}>BalotaChain</div>
      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 12, letterSpacing: 1.4, fontWeight: 500 }}>
        SECURE · PRIVATE · VERIFIABLE
      </div>
      <div style={{ position: 'absolute', bottom: 54, display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => <div key={i} className="ba-dot" style={{ animationDelay: `${i*0.16}s` }} />)}
      </div>
    </div>
  );
}

// ───────────────────────── 2. Onboarding ─────────────────────────
const SLIDES = [
  { icon: 'lock', title: 'Your vote is private',
    body: 'Your ballot is encrypted on your device before it ever leaves your phone.' },
  { icon: 'shieldCheck', title: 'Your vote is verifiable',
    body: 'After voting, you get a code to confirm your vote was counted — without revealing your choice.' },
  { icon: 'globe', title: 'Anyone can check the results',
    body: 'The entire election can be independently verified by anyone, at any time.' },
];

function OnboardingScreen({ nav }) {
  const [idx, setIdx] = React.useState(0);
  const startX = React.useRef(null);
  const [drag, setDrag] = React.useState(0);

  const onStart = (x) => { startX.current = x; };
  const onMove = (x) => { if (startX.current != null) setDrag(x - startX.current); };
  const onEnd = () => {
    if (startX.current == null) return;
    if (drag < -55 && idx < 2) setIdx(idx + 1);
    else if (drag > 55 && idx > 0) setIdx(idx - 1);
    startX.current = null; setDrag(0);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* skip */}
      <div style={{ height: 58, flexShrink: 0 }} />
      <div style={{ height: 44, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 16px', flexShrink: 0 }}>
        {idx < 2
          ? <TextButton onClick={() => nav('login')} style={{ color: 'var(--text-2)' }}>Skip</TextButton>
          : <div style={{ height: 20 }} />}
      </div>

      {/* swipe track */}
      <div
        style={{ flex: 1, overflow: 'hidden', touchAction: 'pan-y' }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => startX.current != null && onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        <div style={{
          display: 'flex', height: '100%',
          width: '300%',
          transform: `translateX(calc(${-idx * 33.3333}% + ${drag}px))`,
          transition: startX.current == null ? 'transform .34s cubic-bezier(.4,0,.2,1)' : 'none',
        }}>
          {SLIDES.map((s, i) => (
            <div key={i} style={{
              width: '33.3333%', height: '100%', boxSizing: 'border-box',
              padding: '12px 32px 0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}>
              <div style={{
                width: 132, height: 132, borderRadius: 40, marginBottom: 40,
                background: 'var(--teal-light)', color: 'var(--teal)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{BIcons[s.icon](58, 'var(--teal)')}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.25, marginBottom: 14 }}>{s.title}</div>
              <div style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.55, maxWidth: 300, textWrap: 'pretty' }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* dots + cta */}
      <div style={{ flexShrink: 0, padding: '8px 24px 30px' }}>
        <div style={{ marginBottom: 26 }}><PageDots count={3} active={idx} /></div>
        {idx < 2
          ? <PrimaryButton onClick={() => setIdx(idx + 1)}>Next</PrimaryButton>
          : <PrimaryButton onClick={() => nav('login')}>Get Started</PrimaryButton>}
      </div>
    </div>
  );
}

// ───────────────────────── 3. Email login ─────────────────────────
function LoginScreen({ nav, state, set }) {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim());
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopBar title="Sign in" />
      <Body>
        <div style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.55, margin: '4px 0 28px', textWrap: 'pretty' }}>
          Enter your email to securely access your ballot. No password needed.
        </div>
        <TextInput
          label="Email address" placeholder="you@example.com"
          value={state.email} onChange={(v) => set({ email: v })}
          helper="We'll use this to identify your ballot."
        />
      </Body>
      <Footer>
        <PrimaryButton disabled={!valid} onClick={() => nav('home')}>Continue</PrimaryButton>
      </Footer>
    </div>
  );
}

// ───────────────────────── 4. Election home ─────────────────────────
function HomeScreen({ nav }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopBar title="BalotaChain" />
      <Body>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.6, color: 'var(--success)', margin: '6px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--success)', display: 'inline-block' }} />
          ACTIVE ELECTION
        </div>
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: 22,
          border: '1px solid var(--border)', boxShadow: '0 2px 10px -4px rgba(26,37,38,0.10)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 14, textWrap: 'balance' }}>
            Philippine National Elections 2028
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {BIcons.shieldCheck(17, 'var(--text-2)')} 3 positions
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {BIcons.clock(16, 'var(--text-2)')} Closes May 8
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '0 -22px 18px' }} />
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55, textWrap: 'pretty' }}>
            You'll vote for President, Vice President, and up to 12 Senators. It takes about a minute.
          </div>
        </div>
      </Body>
      <Footer>
        <PrimaryButton onClick={() => nav('ballot')}>Start Voting</PrimaryButton>
      </Footer>
    </div>
  );
}

// ───────────────────────── 5. Ballot (stepped, 3 positions) ─────────────────────────
function BallotScreen({ nav, state, set }) {
  const [step, setStep] = React.useState(0);
  const race = RACES[step];
  const choices = state.choices;
  const setChoices = (patch) => set({ choices: { ...choices, ...patch } });

  const single = race.pick === 1;
  const sel = choices[race.key];
  const isSel = (id) => single ? sel === id : sel.includes(id);
  const count = single ? (sel ? 1 : 0) : sel.length;
  const atCap = !single && count >= race.pick;
  const canAdvance = count >= 1;

  const pick = (id) => {
    if (single) { setChoices({ [race.key]: id }); }
    else if (sel.includes(id)) { setChoices({ [race.key]: sel.filter((x) => x !== id) }); }
    else if (!atCap) { setChoices({ [race.key]: [...sel, id] }); }
  };

  const back = () => (step === 0 ? nav('home', 'back') : setStep(step - 1));
  const next = () => (step < RACES.length - 1 ? setStep(step + 1) : nav('review'));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopBar title={race.label} onBack={back} />
      {/* progress */}
      <div style={{ padding: '0 24px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {RACES.map((r, i) => (
            <div key={r.key} style={{
              flex: 1, height: 5, borderRadius: 9999,
              background: i < step ? 'var(--teal)' : i === step ? 'var(--teal)' : 'var(--border)',
              opacity: i <= step ? 1 : 1, transition: 'background .2s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: 'var(--text-2)' }}>
            POSITION {step + 1} OF {RACES.length}
          </div>
          <div style={{ fontSize: 13, color: single ? 'var(--text-2)' : (atCap ? 'var(--warning)' : 'var(--teal)'), fontWeight: 600 }}>
            {single ? 'Choose one' : `${count} of ${race.pick} selected`}
          </div>
        </div>
      </div>

      <Body style={{ paddingTop: 12 }}>
        <div key={step} className="ba-rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {race.candidates.map((c) => (
            <OptionCard key={c.id} {...c}
              multi={!single}
              selected={isSel(c.id)}
              disabled={!single && atCap && !isSel(c.id)}
              onClick={() => pick(c.id)} />
          ))}
        </div>
        <div style={{ height: 12 }} />
      </Body>
      <Footer>
        <PrimaryButton disabled={!canAdvance} onClick={next}>
          {step < RACES.length - 1 ? 'Next' : 'Review'}
        </PrimaryButton>
      </Footer>
    </div>
  );
}

// ───────────────────────── 6. Review & confirm ─────────────────────────
function ReviewRow({ c, big = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: big ? '2px 0' : '9px 0' }}>
      <div style={{
        width: big ? 46 : 38, height: big ? 46 : 38, borderRadius: big ? 14 : 11, flexShrink: 0, background: 'var(--teal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: big ? 16 : 14, fontWeight: 600,
      }}>{c.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: big ? 17 : 15.5, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>{c.name}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 2 }}>{c.role}</div>
      </div>
    </div>
  );
}

function ReviewBlock({ label, children, count }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text-2)' }}>{label}</div>
        {count != null && <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>{count}</div>}
      </div>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: '8px 16px',
        border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(26,37,38,0.04)',
      }}>{children}</div>
    </div>
  );
}

function ReviewScreen({ nav, state }) {
  const c = state.choices;
  const pres = ALL[c.president];
  const vp = ALL[c.vp];
  const sens = c.senators.map((id) => ALL[id]);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopBar title="Review your vote" onBack={() => nav('ballot', 'back')} />
      <Body>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, margin: '2px 0 18px', textWrap: 'pretty' }}>
          Confirm your choices before submitting.
        </div>

        {pres && <ReviewBlock label="PRESIDENT"><ReviewRow c={pres} big /></ReviewBlock>}
        {vp && <ReviewBlock label="VICE PRESIDENT"><ReviewRow c={vp} big /></ReviewBlock>}
        <ReviewBlock label="SENATORS" count={`${sens.length} of 12`}>
          {sens.length === 0
            ? <div style={{ padding: '12px 0', fontSize: 14, color: 'var(--text-2)' }}>No senators selected</div>
            : sens.map((s, i) => (
                <div key={s.id} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <ReviewRow c={s} />
                </div>
              ))}
        </ReviewBlock>

        <div style={{
          marginTop: 6, display: 'flex', gap: 12, alignItems: 'flex-start',
          background: 'var(--warn-light)', borderRadius: 12, padding: '14px 16px',
          border: '1px solid var(--warn-border)',
        }}>
          <div style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>{BIcons.alert(22, 'var(--warning)')}</div>
          <div style={{ fontSize: 14.5, color: 'var(--warn-text)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Once submitted, your vote is final and cannot be changed.
          </div>
        </div>
        <div style={{ height: 8 }} />
      </Body>
      <Footer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PrimaryButton onClick={() => nav('submitted')}>Submit Vote</PrimaryButton>
          <SecondaryButton onClick={() => nav('ballot', 'back')}>Go back</SecondaryButton>
        </div>
      </Footer>
    </div>
  );
}

// ───────────────────────── 7. Vote submitted ─────────────────────────
function SubmittedScreen({ nav }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(TRACKING_CODE).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ height: 58, flexShrink: 0 }} />
      <Body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 24 }}>
        <div className="ba-pop" style={{
          width: 92, height: 92, borderRadius: 9999, marginBottom: 22,
          background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 9999, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {BIcons.check(36, '#fff', 3)}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)' }}>Vote submitted</div>
        <div style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.55, marginTop: 10, maxWidth: 290, textWrap: 'pretty' }}>
          Your vote has been securely recorded.
        </div>

        <div style={{
          width: '100%', marginTop: 28, background: 'var(--surface)', borderRadius: 'var(--r-card)',
          border: '1px solid var(--border)', padding: 20, boxShadow: '0 2px 10px -4px rgba(26,37,38,0.10)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-2)', marginBottom: 12 }}>
            YOUR TRACKING CODE
          </div>
          <div style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 26, fontWeight: 600,
            color: 'var(--teal-dark)', letterSpacing: 2, marginBottom: 16,
          }}>{TRACKING_CODE}</div>
          <button onClick={copy} style={{
            width: '100%', minHeight: 48, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            border: '1.5px solid var(--border)', background: copied ? 'var(--teal-light)' : 'var(--surface)',
            color: copied ? 'var(--teal)' : 'var(--text-1)', fontSize: 15, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s',
          }}>
            {copied ? BIcons.check(18, 'var(--teal)', 2.4) : BIcons.copy(18, 'var(--text-1)')}
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 14, textWrap: 'pretty' }}>
            Keep this code to verify your vote anytime — it never reveals your choice.
          </div>
        </div>
      </Body>
      <Footer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PrimaryButton onClick={() => nav('verify')}>Verify my vote</PrimaryButton>
          <SecondaryButton onClick={() => nav('home')}>Done</SecondaryButton>
        </div>
      </Footer>
    </div>
  );
}

// ───────────────────────── 8. Verification ─────────────────────────
function VerifyScreen({ nav }) {
  const [code, setCode] = React.useState(TRACKING_CODE);
  const [verified, setVerified] = React.useState(false);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TopBar title="Verify your vote" onBack={() => nav('submitted', 'back')} />
      <Body>
        <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.55, margin: '2px 0 22px', textWrap: 'pretty' }}>
          Enter your tracking code to confirm your vote was counted.
        </div>
        <TextInput label="Tracking code" value={code} onChange={(v) => { setCode(v); setVerified(false); }} mono />
        <div style={{ height: 18 }} />
        <PrimaryButton onClick={() => setVerified(true)}>Verify</PrimaryButton>

        {verified && (
          <div className="ba-rise" style={{
            marginTop: 26, background: 'var(--success-light)', borderRadius: 'var(--r-card)',
            border: '1px solid var(--success-border)', padding: 22, textAlign: 'center',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 9999, background: 'var(--success)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {BIcons.check(30, '#fff', 3)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-text)', lineHeight: 1.35 }}>
              Your vote is recorded and counted
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 8 }}>
              Verified on the public bulletin board.
            </div>
          </div>
        )}
      </Body>
      <div style={{ height: 30, flexShrink: 0 }} />
    </div>
  );
}

Object.assign(window, {
  SplashScreen, OnboardingScreen, LoginScreen, HomeScreen,
  BallotScreen, ReviewScreen, SubmittedScreen, VerifyScreen,
});
