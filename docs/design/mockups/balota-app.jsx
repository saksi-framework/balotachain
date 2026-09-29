// balota-app.jsx — navigation shell, transitions, tweaks
const SCREENS = {
  splash: window.SplashScreen,
  onboarding: window.OnboardingScreen,
  login: window.LoginScreen,
  home: window.HomeScreen,
  ballot: window.BallotScreen,
  review: window.ReviewScreen,
  submitted: window.SubmittedScreen,
  verify: window.VerifyScreen,
};

const ACCENTS = {
  Teal:   ['#0F6E6E', '#0A5252', '#E3F1F1'],
  Forest: ['#1E7A57', '#145C40', '#E2F1EA'],
  Indigo: ['#3A5BC7', '#2B45A0', '#E8ECFA'],
  Plum:   ['#7A4A8C', '#5E376C', '#F1E9F4'],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#0F6E6E", "#0A5252", "#E3F1F1"],
  "cardRadius": 16,
  "bg": "#FAFAF8"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('splash');
  const [dir, setDir] = React.useState('fwd');
  const [state, setState] = React.useState({ email: '', choices: { president: null, vp: null, senators: [] } });

  const nav = (target, d = 'fwd') => { setDir(d); setScreen(target); };
  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  // Global hook for PPTX export: seeds demo data so populated screens render.
  React.useEffect(() => {
    window.__balotaExport = (name) => {
      const R = window.RACES;
      if (R && ['ballot', 'review', 'submitted', 'verify'].includes(name)) {
        setState((s) => ({
          ...s, email: 'voter@example.com',
          choices: {
            president: 'p-reyes', vp: 'v-aquino',
            senators: R[2].candidates.slice(0, 12).map((c) => c.id),
          },
        }));
      }
      setDir('fwd'); setScreen(name);
    };
  }, []);

  // apply tweaks to CSS vars
  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--teal', t.accent[0]);
    r.setProperty('--teal-dark', t.accent[1]);
    r.setProperty('--teal-light', t.accent[2]);
    r.setProperty('--r-card', t.cardRadius + 'px');
    r.setProperty('--bg', t.bg);
  }, [t.accent, t.cardRadius, t.bg]);

  const Screen = SCREENS[screen];
  const dark = screen === 'splash';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <IOSDevice width={390} height={844} dark={dark} className="export-frame">
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div key={screen} className={dir === 'fwd' ? 'ba-screen-fwd' : 'ba-screen-back'}
            style={{ position: 'absolute', inset: 0 }}>
            <Screen nav={nav} state={state} set={set} />
          </div>
        </div>
      </IOSDevice>

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent}
          options={Object.values(ACCENTS)}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Shape & surface" />
        <TweakSlider label="Card corners" value={t.cardRadius} min={8} max={22} step={1} unit="px"
          onChange={(v) => setTweak('cardRadius', v)} />
        <TweakColor label="Background" value={t.bg}
          options={['#FAFAF8', '#F6F7F8', '#FFFFFF', '#F5F3EE']}
          onChange={(v) => setTweak('bg', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
