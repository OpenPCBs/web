import { useMemo, useState } from 'react';
import {
  Activity, BookOpen, Check, ChevronDown, Cpu, Crown, Download,
  FlaskConical, Play, RefreshCw, Search, Settings2, ShieldCheck,
  Sparkles, Swords, Trophy, Zap,
} from 'lucide-react';

const commanders = [
  { name: 'Atraxa, Praetors’ Voice', colors: ['W', 'U', 'B', 'G'], meta: 'Counters • Midrange', score: 94, games: '18.4k' },
  { name: 'The Ur-Dragon', colors: ['W', 'U', 'B', 'R', 'G'], meta: 'Dragons • Ramp', score: 91, games: '12.7k' },
  { name: 'Muldrotha, the Gravetide', colors: ['U', 'B', 'G'], meta: 'Graveyard • Value', score: 89, games: '15.1k' },
];

const tournamentDecks = [
  { name: 'Domain Ramp', format: 'Standard', record: '9–1', event: 'Regional Championship', colors: ['W', 'U', 'B', 'R', 'G'] },
  { name: 'Dimir Midrange', format: 'Standard', record: '12–2', event: 'Pro Tour Top 8', colors: ['U', 'B'] },
  { name: 'Tymna / Kraum Blue Farm', format: 'Commander', record: '7–0', event: 'cEDH Open', colors: ['W', 'U', 'B', 'R'] },
];

const mana = { W: '◇', U: '●', B: '●', R: '●', G: '●' };

function Mana({ colors }) {
  return <span className="mana-row">{colors.map((color) => <span key={color} className={`mana mana-${color}`}>{mana[color]}</span>)}</span>;
}

function App() {
  const [format, setFormat] = useState('Commander');
  const [selected, setSelected] = useState(commanders[0]);
  const [simulations, setSimulations] = useState(10000);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => commanders.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [query]);

  function optimize() {
    setRunning(true);
    setReady(false);
    window.setTimeout(() => { setRunning(false); setReady(true); }, 1600);
  }

  return (
    <div className="app">
      <header>
        <a className="logo" href="#top" aria-label="ManaForge home"><span className="logo-gem"><Sparkles size={19} /></span><span>Mana<span>Forge</span></span></a>
        <nav><a className="active" href="#builder">Deck Builder</a><a href="#decks">Tournament Decks</a><a href="#library">Card Library</a></nav>
        <div className="header-actions"><button className="icon-button" aria-label="Settings"><Settings2 size={18} /></button><button className="download"><Download size={17} /> Download for Windows</button></div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span></span> AI DECK OPTIMIZATION • BUILT FOR AMD</div>
            <h1>Build decks that<br /><em>win more.</em></h1>
            <p>Run thousands of local simulations against proven tournament strategies. ManaForge finds the strongest 100 cards for your commander—or the sharpest 60 for Standard.</p>
            <div className="hero-buttons"><a className="primary" href="#builder"><Zap size={18} fill="currentColor" /> Start building</a><button className="ghost"><Play size={17} fill="currentColor" /> See how it works</button></div>
            <div className="trust"><span><ShieldCheck size={17} /> Legal cards only</span><span><Cpu size={17} /> NPU accelerated</span><span><BookOpen size={17} /> Offline card database</span></div>
          </div>
          <div className="hero-visual" aria-label="Deck optimization preview">
            <div className="glow"></div>
            <div className="card-stack"><div className="game-card back-two"></div><div className="game-card back-one"></div><div className="game-card front"><div className="card-cost"><Mana colors={selected.colors} /></div><div className="card-art"><Crown size={68} /></div><b>{selected.name}</b><small>Legendary Creature — Commander</small><div className="card-rule">Your deck learns from every simulation. Optimize synergy, curve, and interaction.</div></div></div>
            <div className="float-stat stat-one"><Activity size={17} /><span><b>10,000+</b> matchups tested</span></div>
            <div className="float-stat stat-two"><Trophy size={17} /><span><b>+18.6%</b> projected win rate</span></div>
          </div>
        </section>

        <section className="metrics">
          <div><b>31,000+</b><span>legal cards indexed</span></div><div><b>10,000</b><span>simulations per build</span></div><div><b>3 years</b><span>of tournament results</span></div><div><b>100%</b><span>runs locally</span></div>
        </section>

        <section className="builder-section" id="builder">
          <div className="section-heading"><div><span className="kicker">THE FORGE</span><h2>Design your next deck</h2><p>Choose a format and strategy. The optimizer handles the rest.</p></div><span className="status"><span></span> Card data ready</span></div>
          <div className="builder-grid">
            <aside className="setup-panel">
              <div className="step-title"><span>1</span><div><b>Choose format</b><small>Select your rule set</small></div></div>
              <div className="segment">{['Commander', 'Standard'].map((item) => <button className={format === item ? 'selected' : ''} onClick={() => setFormat(item)} key={item}>{item === 'Commander' ? <Crown size={17} /> : <Swords size={17} />}{item}</button>)}</div>
              <div className="step-title"><span>2</span><div><b>{format === 'Commander' ? 'Select commander' : 'Choose colors'}</b><small>{format === 'Commander' ? 'Your deck’s centerpiece' : 'Set your color identity'}</small></div></div>
              <label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search commanders..." /></label>
              <div className="commander-list">{filtered.map((item) => <button key={item.name} className={selected.name === item.name ? 'commander selected' : 'commander'} onClick={() => setSelected(item)}><span className="avatar">{item.name.charAt(0)}</span><span><b>{item.name}</b><small>{item.meta}</small></span><Mana colors={item.colors} />{selected.name === item.name && <Check size={17} />}</button>)}</div>
              <div className="step-title"><span>3</span><div><b>Simulation depth</b><small>More runs, stronger results</small></div></div>
              <div className="range-label"><b>{simulations.toLocaleString()} games</b><span>~{Math.round(simulations / 4000)} min on AMD NPU</span></div>
              <input className="range" type="range" min="1000" max="25000" step="1000" value={simulations} onChange={(e) => setSimulations(Number(e.target.value))} />
              <button className="forge-button" onClick={optimize} disabled={running}>{running ? <RefreshCw className="spin" size={19} /> : <FlaskConical size={19} />}{running ? 'Simulating matchups…' : 'Forge my deck'}<span>→</span></button>
            </aside>

            <div className="results-panel">
              <div className="results-top"><div><span className="kicker">OPTIMIZATION PREVIEW</span><h3>{selected.name}</h3><div className="subline"><Mana colors={selected.colors} /> {format} • {simulations.toLocaleString()} simulations</div></div><div className="score"><b>{ready ? '96' : selected.score}</b><span>SYNERGY</span></div></div>
              <div className="chart"><div className="chart-head"><b>Projected win rate</b><span>{ready ? '67.8%' : '64.2%'}</span></div><div className="bars">{[35,46,40,53,49,61,58,68,64,76,72,86,82,91].map((height, i) => <i key={i} style={{height: `${height}%`}}></i>)}</div><div className="axis"><span>1k</span><span>5k</span><span>10k simulations</span></div></div>
              <div className="result-stats"><div><span>AVG. MANA VALUE</span><b>2.84</b><small>Balanced curve</small></div><div><span>INTERACTION</span><b>18</b><small>Removal + counters</small></div><div><span>LANDS</span><b>36</b><small>98.2% consistency</small></div></div>
              <div className={ready ? 'ready-message show' : 'ready-message'}><Check size={18} /> Optimization complete. Your deck list is ready to export.</div>
              <div className="engine-note"><Cpu size={22} /><div><b>AMD Ryzen AI detected</b><small>Simulations will run on your NPU, keeping card data and results private.</small></div><span>READY</span></div>
            </div>
          </div>
        </section>

        <section className="tournaments" id="decks">
          <div className="section-heading"><div><span className="kicker">PROVEN STRATEGIES</span><h2>Recent tournament winners</h2><p>Winning archetypes provide the baseline for every simulation.</p></div><button className="view-all">View all decks <ChevronDown size={16} /></button></div>
          <div className="deck-grid">{tournamentDecks.map((deck, index) => <article key={deck.name}><div className={`deck-art art-${index}`}><Trophy size={34} /><span>{deck.record}</span></div><div className="deck-content"><div className="deck-tag">{deck.format}</div><h3>{deck.name}</h3><p>{deck.event}</p><div className="deck-footer"><Mana colors={deck.colors} /><button>View list →</button></div></div></article>)}</div>
        </section>
      </main>
      <footer><div className="logo"><span className="logo-gem"><Sparkles size={16} /></span><span>Mana<span>Forge</span></span></div><p>Local-first deck intelligence for Magic players.</p><span>Data sources connect during desktop setup.</span></footer>
    </div>
  );
}

export default App;
