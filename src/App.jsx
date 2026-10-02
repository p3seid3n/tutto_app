import { useEffect, useLayoutEffect, useRef, useState } from "react";

const TARGET = 6000; // first to reach this wins
const HUES = [265, 170, 330, 30, 210, 95, 290, 5];
const MAX_PLAYERS = HUES.length;
const SHEET_H = 480;
const PEEK = 100;
const HIDDEN = SHEET_H - PEEK;

const I = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  next: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  del: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z",
  play: "M8 5v14l11-7z",
};
const Icon = ({ d, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
);

const Avatar = ({ p, size = 44 }) => (
  <div className="avatar" style={{
    width: size, height: size, fontSize: size * 0.42,
    background: `hsl(${p.hue} 80% 86%)`, color: `hsl(${p.hue} 55% 22%)`,
  }}>{p.name[0].toUpperCase()}</div>
);

function useCountUp(target) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current, t0 = performance.now();
    if (from === target) return;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      cur.current = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      setShown(cur.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

/* ───────────── Home ───────────── */
function Home({ players, setPlayers, onStart }) {
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(null);
  const full = players.length >= MAX_PLAYERS;

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || full) return;
    const hue = HUES.find((h) => !players.some((p) => p.hue === h));
    setPlayers([...players, { id: Math.random().toString(36).slice(2), name: n, hue }]);
    setName("");
  };
  const remove = (id) => {
    setLeaving(id);
    setTimeout(() => { setPlayers((ps) => ps.filter((p) => p.id !== id)); setLeaving(null); }, 280);
  };

  return (
    <div className="screen home">
      <div className="hero">
        <div className="logo">🎲</div>
        <h1>Tutto</h1>
        <p>Add the players, then roll.</p>
      </div>

      <form className="field" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={`Player name (${players.length}/${MAX_PLAYERS})`} maxLength={14} />
        <button className="fab" type="submit" disabled={!name.trim() || full} aria-label="Add player">
          <Icon d={I.add} />
        </button>
      </form>

      <ul className="chips">
        {players.length === 0 && <li className="empty">No players yet</li>}
        {players.map((p) => (
          <li key={p.id} className={`chip ${leaving === p.id ? "leave" : ""}`}>
            <Avatar p={p} />
            <b>{p.name}</b>
            <button className="icon-btn" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>
              <Icon d={I.close} size={20} />
            </button>
          </li>
        ))}
      </ul>

      <button className="start" disabled={players.length < 2} onClick={onStart}>
        <Icon d={I.play} /> Start game
      </button>
    </div>
  );
}

/* ───────────── Ranking ───────────── */
function Row({ p, rank, current, setRef }) {
  const card = useRef();
  const first = useRef(true);
  const shown = useCountUp(p.points);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    card.current.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }],
      { duration: 600, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
  }, [p.points]);
  return (
    <li className="row" ref={setRef}>
      <div ref={card} className={`card ${current ? "now" : ""}`}>
        <span className="rank">{rank === 1 && p.points > 0 ? "👑" : rank}</span>
        <Avatar p={p} />
        <div className="info">
          <div className="line"><b>{p.name}</b>{current && <em>Turn</em>}</div>
          <div className="track"><div className="fill" style={{ width: `${Math.min(100, (p.points / TARGET) * 100)}%` }} /></div>
        </div>
        <span className="pts">{shown.toLocaleString()}</span>
      </div>
    </li>
  );
}

function Ranking({ players, turnId }) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const refs = useRef({});
  const prev = useRef({});

  // FLIP: rows glide (with overshoot) to their new rank
  useLayoutEffect(() => {
    sorted.forEach((p) => {
      const el = refs.current[p.id];
      if (!el) return;
      const top = el.offsetTop, old = prev.current[p.id];
      if (old !== undefined && old !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${old - top}px)`;
        el.getBoundingClientRect();
        el.style.transition = "transform .7s cubic-bezier(.34,1.56,.64,1)";
        el.style.transform = "";
      }
      prev.current[p.id] = top;
    });
  });

  return (
    <ul className="list">
      {sorted.map((p, i) => (
        <Row key={p.id} p={p} rank={i + 1} current={p.id === turnId}
          setRef={(el) => (refs.current[p.id] = el)} />
      ))}
    </ul>
  );
}

/* ───────────── Game ───────────── */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

function Game({ initial, onHome, onRematch }) {
  const [players, setPlayers] = useState(() => initial.map((p) => ({ ...p, points: 0 })));
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const [drag, setDrag] = useState(null);
  const [winner, setWinner] = useState(null);
  const [done, setDone] = useState(false);
  const gest = useRef(null);
  const cur = players[turn];
  const value = parseInt(input || "0", 10);

  useEffect(() => {
    if (done || winner) return;
    const w = players.find((p) => p.points >= TARGET);
    if (w) setWinner(w);
  }, [players, done, winner]);

  const press = (k) => {
    navigator.vibrate?.(8);
    if (k === "del") return setInput((s) => s.slice(0, -1));
    setInput((s) => {
      const n = (s + k).replace(/^0+/, "");
      return n.length > 5 ? s : n;
    });
  };
  const bank = () => {
    setPlayers((ps) => ps.map((p, i) => (i === turn ? { ...p, points: p.points + value } : p)));
    setInput("");
  };
  const add = () => { if (value) { navigator.vibrate?.(15); bank(); } };
  const next = () => {
    if (value) bank();
    setInput("");
    setTurn((t) => {
      if (t + 1 === players.length) setRound((r) => r + 1);
      return (t + 1) % players.length;
    });
  };

  // sheet drag
  const down = (e) => {
    gest.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const g = gest.current;
    if (!g) return;
    g.dy = e.clientY - g.y;
    const base = open ? 0 : HIDDEN;
    setDrag(Math.min(HIDDEN + 24, Math.max(-24, base + g.dy)));
  };
  const up = () => {
    const g = gest.current;
    gest.current = null;
    if (!g) return;
    const v = g.dy / (performance.now() - g.t);
    if (Math.abs(g.dy) < 6) setOpen((o) => !o);
    else if (Math.abs(v) > 0.4) setOpen(g.dy < 0);
    else setOpen((open ? 0 : HIDDEN) + g.dy < HIDDEN / 2);
    setDrag(null);
  };

  return (
    <div className="screen game">
      <div className="scroll" style={{ paddingBottom: (open ? SHEET_H : PEEK) + 16 }}>
        <header className="top">
          <button className="icon-btn" onClick={onHome} aria-label="Back to menu"><Icon d={I.back} /></button>
          <div>
            <h2>Ranking</h2>
            <span>Round {round} · first to {TARGET.toLocaleString()}</span>
          </div>
        </header>
        <Ranking players={players} turnId={cur.id} />
      </div>

      <section className="sheet" style={{
        transform: `translateY(${drag ?? (open ? 0 : HIDDEN)}px)`,
        transition: drag === null ? "transform .8s cubic-bezier(.34,1.56,.64,1)" : "none",
      }}>
        <div className="grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <i className="pill" />
          <div className="turn" key={cur.id}>
            <Avatar p={cur} size={44} />
            <div className="who"><b>{cur.name}</b><span>{cur.points.toLocaleString()} pts</span></div>
            <div className={`pending ${value ? "" : "zero"}`} key={input}>+{value.toLocaleString()}</div>
          </div>
        </div>

        <div className="pad">
          {KEYS.map((k) => (
            <button key={k} className={`key ${k === "del" ? "fn" : ""}`} onClick={() => press(k)}
              aria-label={k === "del" ? "Delete" : k}>
              {k === "del" ? <Icon d={I.del} /> : k}
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="btn tonal" onClick={next}>Next <Icon d={I.next} /></button>
          <button className="btn filled" onClick={add} disabled={!value}><Icon d={I.add} /> Add</button>
        </div>
      </section>

      {winner && (
        <div className="scrim">
          <div className="dialog">
            <div className="trophy">🏆</div>
            <h3>{winner.name} wins!</h3>
            <p>{winner.points.toLocaleString()} points in {round} rounds</p>
            <div className="dactions">
              <button className="btn text" onClick={() => { setWinner(null); setDone(true); }}>Keep playing</button>
              <button className="btn filled" onClick={onRematch}>Rematch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── App ───────────── */
export default function App() {
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(0); // 0 = home, otherwise remount key
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {game === 0 ? (
          <Home players={players} setPlayers={setPlayers} onStart={() => setGame(1)} />
        ) : (
          <Game key={game} initial={players} onHome={() => setGame(0)} onRematch={() => setGame((g) => g + 1)} />
        )}
      </div>
    </>
  );
}

/* ───────────── Styles (Material 3 tokens) ───────────── */
const CSS = `
:root{
  --primary:#6750A4;--on-primary:#fff;--primary-c:#EADDFF;--on-primary-c:#21005D;
  --secondary-c:#E8DEF8;--on-secondary-c:#1D192B;--tertiary-c:#FFD8E4;--on-tertiary-c:#31111D;
  --surface:#FEF7FF;--surface-c:#F3EDF7;--surface-ch:#ECE6F0;--surface-chh:#E6E0E9;
  --on-surface:#1D1B20;--on-surface-v:#49454F;--outline-v:#CAC4D0;
  --spring:cubic-bezier(.34,1.56,.64,1);
}
@media (prefers-color-scheme:dark){:root{
  --primary:#D0BCFF;--on-primary:#381E72;--primary-c:#4F378B;--on-primary-c:#EADDFF;
  --secondary-c:#4A4458;--on-secondary-c:#E8DEF8;--tertiary-c:#633B48;--on-tertiary-c:#FFD8E4;
  --surface:#141218;--surface-c:#211F26;--surface-ch:#2B2930;--surface-chh:#36343B;
  --on-surface:#E6E0E9;--on-surface-v:#CAC4D0;--outline-v:#49454F;
}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;margin:0}
body{background:var(--surface-c);color:var(--on-surface);-webkit-font-smoothing:antialiased;
  font-family:"Google Sans Flex","Roboto Flex",Roboto,system-ui,sans-serif;overscroll-behavior:none}
button,input{font:inherit;color:inherit}
button{border:0;cursor:pointer;user-select:none}
.app{height:100dvh;max-width:480px;margin:0 auto;position:relative;overflow:hidden;background:var(--surface)}
.screen{position:absolute;inset:0;animation:rise .7s var(--spring) both}
@keyframes rise{from{transform:translateY(40px) scale(.96);opacity:0}}
@keyframes pop{from{transform:scale(.5);opacity:0}}
@keyframes bump{from{transform:scale(.6) translateY(6px);opacity:0}}
@keyframes swap{from{transform:translateY(16px);opacity:0}}
@keyframes out{to{transform:scale(.6);opacity:0}}
@keyframes fade{from{opacity:0}}
@keyframes wobble{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) scale(1.06)}}
.avatar{display:grid;place-items:center;border-radius:36%;font-weight:700;flex:none}

.home{display:flex;flex-direction:column;gap:20px;
  padding:max(32px,env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))}
.hero{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 0 4px;text-align:center}
.logo{width:96px;height:96px;display:grid;place-items:center;font-size:48px;
  background:var(--primary-c);border-radius:32px;animation:wobble 5s ease-in-out infinite}
.hero h1{margin:8px 0 0;font-size:48px;font-weight:700;letter-spacing:-1px}
.hero p{margin:0;color:var(--on-surface-v)}
.field{display:flex;gap:10px}
.field input{flex:1;min-width:0;height:60px;padding:0 22px;border-radius:30px;border:2px solid transparent;
  background:var(--surface-ch);outline:0;font-size:17px;
  transition:border-color .2s,border-radius .5s var(--spring)}
.field input:focus{border-color:var(--primary);border-radius:22px}
.fab{width:60px;height:60px;border-radius:22px;background:var(--primary-c);color:var(--on-primary-c);
  display:grid;place-items:center;transition:transform .5s var(--spring),border-radius .5s var(--spring),opacity .2s}
.fab:active:not(:disabled){transform:scale(.85);border-radius:30px}
.fab:disabled{opacity:.38}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1}
.chip{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 10px;border-radius:28px;
  background:var(--surface-ch);animation:pop .55s var(--spring) both}
.chip.leave{animation:out .28s ease-in forwards}
.chip b{flex:1;font-weight:500;font-size:17px}
.empty{text-align:center;color:var(--on-surface-v);padding:24px 0}
.icon-btn{width:44px;height:44px;border-radius:50%;background:transparent;display:grid;place-items:center;
  color:var(--on-surface-v);transition:transform .5s var(--spring),background .2s}
.icon-btn:active{transform:scale(.78);background:var(--surface-chh)}
.start{height:64px;border-radius:32px;background:var(--primary);color:var(--on-primary);font-size:18px;
  font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .5s var(--spring),border-radius .5s var(--spring),background .3s}
.start:active:not(:disabled){transform:scale(.95);border-radius:22px}
.start:disabled{background:var(--surface-chh);color:var(--on-surface-v);opacity:.6;cursor:default}

.scroll{position:absolute;inset:0;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 16px 0;
  transition:padding-bottom .8s var(--spring)}
.top{display:flex;align-items:center;gap:8px;padding:4px 0 16px}
.top h2{margin:0;font-size:32px;font-weight:600;line-height:1.1}
.top span{font-size:14px;color:var(--on-surface-v)}
.list{list-style:none;margin:0;padding:0;position:relative}
.row{padding-bottom:8px}
.card{display:flex;align-items:center;gap:12px;padding:10px 18px 10px 14px;border-radius:28px;background:var(--surface-c)}
.card.now{background:var(--primary-c);color:var(--on-primary-c)}
.rank{width:24px;text-align:center;font-weight:600;color:var(--on-surface-v)}
.card.now .rank{color:inherit}
.info{flex:1;min-width:0}
.line{display:flex;align-items:center;gap:8px}
.line b{font-weight:600;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.line em{font-style:normal;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;
  background:var(--primary);color:var(--on-primary);animation:pop .5s var(--spring) both}
.track{height:8px;border-radius:4px;margin-top:8px;overflow:hidden;background:color-mix(in srgb,currentColor 14%,transparent)}
.fill{height:100%;border-radius:4px;background:var(--primary);transition:width .9s var(--spring)}
.pts{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}

.sheet{position:absolute;left:0;right:0;bottom:0;height:${SHEET_H}px;background:var(--surface-ch);
  border-radius:32px 32px 0 0;box-shadow:0 -4px 24px rgb(0 0 0/.12);display:flex;flex-direction:column;
  padding:0 16px calc(16px + env(safe-area-inset-bottom));will-change:transform}
.sheet::after{content:"";position:absolute;left:0;right:0;top:100%;height:120px;background:inherit}
.grab{touch-action:none;cursor:grab;padding-top:10px;height:${PEEK}px;flex:none}
.pill{display:block;width:36px;height:5px;border-radius:3px;background:var(--outline-v);margin:0 auto 12px}
.turn{display:flex;align-items:center;gap:12px;animation:swap .6s var(--spring) both}
.who{display:flex;flex-direction:column;flex:1;min-width:0}
.who b{font-size:18px;font-weight:600}
.who span{font-size:13px;color:var(--on-surface-v)}
.pending{font-size:34px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums;animation:bump .4s var(--spring) both}
.pending.zero{opacity:.35}
.pad{flex:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:8px;margin-top:4px;min-height:0}
.key{border-radius:22px;background:var(--surface-chh);font-size:24px;font-weight:500;display:grid;place-items:center;
  transition:transform .5s var(--spring),border-radius .5s var(--spring),background .2s}
.key:active{transform:scale(.9);border-radius:32px;transition-duration:.1s;background:var(--secondary-c)}
.key.fn{background:var(--secondary-c);color:var(--on-secondary-c)}
.actions{display:grid;grid-template-columns:1fr 1.3fr;gap:8px;margin-top:12px}
.btn{height:60px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:8px;
  font-size:17px;font-weight:600;transition:transform .5s var(--spring),border-radius .5s var(--spring),opacity .2s}
.btn:active:not(:disabled){transform:scale(.93);border-radius:20px}
.btn.tonal{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.btn.filled{background:var(--primary);color:var(--on-primary)}
.btn.text{background:transparent;color:var(--primary)}
.btn:disabled{opacity:.38;cursor:default}

.scrim{position:absolute;inset:0;background:rgb(0 0 0/.4);display:grid;place-items:center;padding:24px;z-index:10;animation:fade .3s both}
.dialog{width:100%;background:var(--surface-ch);border-radius:32px;padding:28px 24px 20px;text-align:center;animation:pop .7s var(--spring) both}
.trophy{font-size:56px}
.dialog h3{margin:8px 0 4px;font-size:26px}
.dialog p{margin:0 0 20px;color:var(--on-surface-v)}
.dactions{display:flex;gap:8px}
.dactions .btn{flex:1;height:52px}

@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;
