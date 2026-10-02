import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DEFAULT_TARGET = 6000;
const MIN_TARGET = 500;
const MAX_TARGET = 100000;
const STEP = 500;
const PRESETS = [2000, 4000, 6000, 10000];
const HUES = [265, 170, 330, 30, 210, 95, 290, 5];
const MAX_PLAYERS = HUES.length;
const SHEET_H = 520;
const PEEK = 100;
const HIDDEN = SHEET_H - PEEK;

const load = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
};
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

/* ───────────── Haptics ─────────────
   Numbers are milliseconds: vibrate, pause, vibrate, ...
   Most phone motors can't render pulses under ~15-20 ms, so keep them above that. */
let HAPTICS = load("tutto:haptics", true);
const buzz = (p) => {
  if (!HAPTICS) return;
  try { navigator.vibrate?.(p); } catch { /* ignore */ }
};
const H = {
  on: [45, 50, 45],
  key: 20,
  key2: [20, 32, 20],
  del: 14,
  sign: [22, 36, 30],
  add: [20, 30, 24, 30, 42],
  sub: [48, 38, 18],
  next: [26, 46, 38],
  select: 26,
  back: [22, 36, 22],
  expand: 20,
  collapse: 14,
  snap: 24,
  tick: 16,
  swap: [20, 46, 20],
  crown: [22, 38, 32, 38, 64],
  win: [30, 60, 30, 60, 50, 60, 90, 70, 200],
  remove: 34,
  addP: [20, 34, 30],
  start: [26, 46, 26, 46, 64],
};

const I = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  rem: "M19 13H5v-2h14v2z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  next: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  del: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z",
  play: "M8 5v14l11-7z",
  undo: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
  chev: "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z",
  vib: "M0 15h2V9H0v6zm3 2h2V7H3v10zm19-8v6h2V9h-2zm-3 8h2V7h-2v10zM16.5 3h-9C6.67 3 6 3.67 6 4.5v15c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zM16 19H8V5h8v14z",
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

const HapticBtn = ({ on, onToggle }) => (
  <button className={`icon-btn hap ${on ? "on" : ""}`} onClick={onToggle} aria-pressed={on} aria-label="Haptic feedback">
    <Icon d={I.vib} />
  </button>
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
function Home({ players, setPlayers, target, setTarget, haptics, onHaptics, onStart }) {
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(null);
  const full = players.length >= MAX_PLAYERS;
  const bump = (d) => { buzz(H.tick); setTarget((t) => Math.min(MAX_TARGET, Math.max(MIN_TARGET, t + d))); };

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || full) return;
    buzz(H.addP);
    const hue = HUES.find((h) => !players.some((p) => p.hue === h));
    setPlayers([...players, { id: Math.random().toString(36).slice(2), name: n, hue }]);
    setName("");
  };
  const remove = (id) => {
    buzz(H.remove);
    setLeaving(id);
    setTimeout(() => { setPlayers((ps) => ps.filter((p) => p.id !== id)); setLeaving(null); }, 280);
  };

  return (
    <div className="screen home">
      <HapticBtn on={haptics} onToggle={onHaptics} />
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

      <div className="goal">
        <div className="goal-row">
          <span>Points to win</span>
          <button className="step" onClick={() => bump(-STEP)} aria-label="Less points"><Icon d={I.rem} /></button>
          <b className="goal-v" key={target}>{target.toLocaleString()}</b>
          <button className="step" onClick={() => bump(STEP)} aria-label="More points"><Icon d={I.add} /></button>
        </div>
        <div className="presets">
          {PRESETS.map((v) => (
            <button key={v} className={`preset ${v === target ? "on" : ""}`}
              onClick={() => { if (v !== target) buzz(H.tick); setTarget(v); }}>
              {v / 1000}k
            </button>
          ))}
        </div>
      </div>

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

      <button className="start" disabled={players.length < 2} onClick={() => { buzz(H.start); onStart(); }}>
        <Icon d={I.play} /> Start game
      </button>
    </div>
  );
}

/* ───────────── Ranking ───────────── */
function Row({ p, rank, current, editing, target, onPick, setRef }) {
  const card = useRef();
  const first = useRef(true);
  const [open, setOpen] = useState(false);
  const shown = useCountUp(p.points);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    card.current.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }],
      { duration: 600, easing: "cubic-bezier(.34,1.56,.64,1)" }
    );
  }, [p.points]);

  const toggle = (e) => {
    e.stopPropagation();
    buzz(open ? H.collapse : H.expand);
    setOpen((o) => !o);
  };
  const log = p.log.map((e, i) => ({ ...e, i })).reverse();

  return (
    <li className="row" ref={setRef}>
      <div ref={card} className={`card ${current ? "now" : ""} ${editing ? "edit" : ""} ${open ? "open" : ""}`}>
        <div className="main" role="button" tabIndex={0}
          onClick={() => onPick(p.id)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onPick(p.id); }}>
          <span className="rank">{rank === 1 && p.points > 0 ? "👑" : rank}</span>
          <Avatar p={p} />
          <div className="info">
            <button className="nm" onClick={toggle} aria-expanded={open} aria-label={`${p.name}: show history`}>
              <b>{p.name}</b>
              {current && <em className="tag">Turn</em>}
              {editing && <em className="tag ed">Editing</em>}
              <span className="chev"><Icon d={I.chev} size={20} /></span>
            </button>
            <div className="track">
              <div className="fill" style={{ width: `${Math.max(0, Math.min(100, (p.points / target) * 100))}%` }} />
            </div>
          </div>
          <span className="pts">{shown.toLocaleString()}</span>
        </div>

        <div className="hist">
          <div className="hist-clip">
            <div className="hist-in">
              {log.length === 0 && <div className="none">No changes yet</div>}
              {log.map((e, n) => (
                <div className="ev" key={e.i} style={{ animationDelay: `${Math.min(n, 8) * 35}ms` }}>
                  <span className={`d ${e.d < 0 ? "neg" : "pos"}`}>
                    {e.d < 0 ? "−" : "+"}{Math.abs(e.d).toLocaleString()}
                  </span>
                  <span className="meta">Round {e.r}{e.fix && <i>correction</i>}</span>
                  <span className="tot">{e.t.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Ranking({ players, turnId, editId, target, onPick }) {
  const sorted = [...players].sort((a, b) => b.points - a.points);
  const listRef = useRef();
  const refs = useRef({});
  const prev = useRef({});
  const order = useRef(null);

  // keep stored positions fresh when tiles expand / collapse
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      Object.keys(refs.current).forEach((id) => {
        const el = refs.current[id];
        if (el) prev.current[id] = el.offsetTop;
      });
    });
    ro.observe(listRef.current);
    return () => ro.disconnect();
  }, []);

  // FLIP: rows glide (with overshoot) to their new rank
  useLayoutEffect(() => {
    const key = sorted.map((p) => p.id).join(",");
    if (order.current !== null && order.current !== key) {
      const leaderChanged = order.current.split(",")[0] !== sorted[0].id && sorted[0].points > 0;
      buzz(leaderChanged ? H.crown : H.swap);
    }
    order.current = key;

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
    <ul className="list" ref={listRef}>
      {sorted.map((p, i) => (
        <Row key={p.id} p={p} rank={i + 1} current={p.id === turnId} editing={p.id === editId}
          target={target} onPick={onPick} setRef={(el) => (refs.current[p.id] = el)} />
      ))}
    </ul>
  );
}

/* ───────────── Game ───────────── */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

function Game({ initial, target, haptics, onHaptics, onHome, onRematch }) {
  const [players, setPlayers] = useState(() => initial.map((p) => ({ ...p, points: 0, log: [] })));
  const [turn, setTurn] = useState(0);
  const [sel, setSel] = useState(null); // id of a non-current player being edited
  const [round, setRound] = useState(1);
  const [input, setInput] = useState("");
  const [neg, setNeg] = useState(false);
  const [open, setOpen] = useState(true);
  const [drag, setDrag] = useState(null);
  const [winner, setWinner] = useState(null);
  const [done, setDone] = useState(false);
  const gest = useRef(null);
  const body = useRef(null);
  const swipe = useRef(null);
  const swiped = useRef(false);

  const cur = players[turn];
  const subject = players.find((p) => p.id === sel) || cur;
  const editing = subject.id !== cur.id;
  const value = parseInt(input || "0", 10);
  const delta = neg ? -value : value;

  useEffect(() => {
    if (done || winner) return;
    const w = players.find((p) => p.points >= target);
    if (w) { setWinner(w); buzz(H.win); }
  }, [players, done, winner, target]);

  const press = (k) => {
    buzz(k === "del" ? H.del : k === "00" ? H.key2 : H.key);
    if (k === "del") return setInput((s) => s.slice(0, -1));
    setInput((s) => {
      const n = (s + k).replace(/^0+/, "");
      return n.length > 5 ? s : n;
    });
  };
  const setSign = (n) => { if (n !== neg) buzz(H.sign); setNeg(n); };

  const bank = () => {
    const id = subject.id, fix = id !== cur.id, d = delta, r = round;
    setPlayers((ps) => ps.map((p) =>
      p.id === id ? { ...p, points: p.points + d, log: [...p.log, { d, r, t: p.points + d, fix }] } : p
    ));
    setInput("");
    setNeg(false);
  };
  const add = () => { if (value) { buzz(neg ? H.sub : H.add); bank(); } };
  const next = () => {
    buzz(H.next);
    if (value) bank();
    setInput("");
    setNeg(false);
    setTurn((t) => {
      if (t + 1 === players.length) setRound((r) => r + 1);
      return (t + 1) % players.length;
    });
  };
  const backToTurn = () => {
    buzz(H.back);
    setSel(null);
    setInput("");
    setNeg(false);
  };
  const pick = (id) => {
    setOpen(true);
    if (id === cur.id) {
      if (sel) backToTurn(); else buzz(H.select);
    } else if (id !== sel) {
      buzz(H.select);
      setSel(id);
      setInput("");
      setNeg(false);
    }
  };

  // swipe left / right on the panel to switch Add <-> Subtract
  const sDown = (e) => {
    swiped.current = false;
    swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), on: false };
  };
  const sMove = (e) => {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) s.on = true;
      else return;
    }
    swiped.current = true;
    const valid = (dx < 0 && !neg) || (dx > 0 && neg);
    const k = valid ? 0.35 : 0.12;
    body.current.style.transition = "none";
    body.current.style.transform = `translateX(${Math.max(-48, Math.min(48, dx * k))}px)`;
  };
  const sEnd = (e, cancel) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !s.on) return;
    body.current.style.transition = "";
    body.current.style.transform = "";
    if (cancel) return;
    const dx = e.clientX - s.x;
    const v = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    if (Math.abs(dx) > 56 || (v > 0.5 && Math.abs(dx) > 24)) {
      if (dx < 0 && !neg) setSign(true);
      else if (dx > 0 && neg) setSign(false);
    }
  };
  const eatClick = (e) => {
    if (swiped.current) { e.stopPropagation(); e.preventDefault(); swiped.current = false; }
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
    let nextOpen;
    if (Math.abs(g.dy) < 6) nextOpen = !open;
    else if (Math.abs(v) > 0.4) nextOpen = g.dy < 0;
    else nextOpen = (open ? 0 : HIDDEN) + g.dy < HIDDEN / 2;
    if (nextOpen !== open) buzz(H.snap);
    setOpen(nextOpen);
    setDrag(null);
  };

  return (
    <div className="screen game">
      <div className="scroll" style={{ paddingBottom: (open ? SHEET_H : PEEK) + 16 }}>
        <header className="top">
          <button className="icon-btn" onClick={onHome} aria-label="Back to menu"><Icon d={I.back} /></button>
          <div>
            <h2>Ranking</h2>
            <span>Round {round} · first to {target.toLocaleString()}</span>
          </div>
          <HapticBtn on={haptics} onToggle={onHaptics} />
        </header>
        <Ranking players={players} turnId={cur.id} editId={editing ? subject.id : null}
          target={target} onPick={pick} />
      </div>

      <section className="sheet" style={{
        transform: `translateY(${drag ?? (open ? 0 : HIDDEN)}px)`,
        transition: drag === null ? "transform .8s cubic-bezier(.34,1.56,.64,1)" : "none",
      }}>
        <div className="grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <i className="pill" />
          <div className="turn" key={subject.id}>
            <Avatar p={subject} size={44} />
            <div className="who">
              <div className="wn">
                <b>{subject.name}</b>
                {editing && <em className="tag ed">Editing</em>}
              </div>
              <span>{subject.points.toLocaleString()} pts</span>
            </div>
            <div className={`pending ${value ? "" : "zero"} ${neg ? "neg" : ""}`} key={input + (neg ? "n" : "p")}>
              {neg ? "−" : "+"}{value.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="body" ref={body}
          onPointerDown={sDown} onPointerMove={sMove}
          onPointerUp={(e) => sEnd(e, false)} onPointerCancel={(e) => sEnd(e, true)}
          onClickCapture={eatClick}>
          <div className={`seg ${neg ? "neg" : ""}`}>
            <i className="ind" />
            <button onClick={() => setSign(false)} className={!neg ? "on" : ""}><Icon d={I.add} size={18} /> Add</button>
            <button onClick={() => setSign(true)} className={neg ? "on" : ""}><Icon d={I.rem} size={18} /> Subtract</button>
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
            {editing ? (
              <button className="btn sec pop" key="back" onClick={backToTurn}>
                <Icon d={I.undo} /> Back to turn
              </button>
            ) : (
              <button className="btn tonal" key="next" onClick={next}>Next <Icon d={I.next} /></button>
            )}
            <button className={`btn filled ${neg ? "neg" : ""}`} onClick={add} disabled={!value}>
              <Icon d={neg ? I.rem : I.add} /> {neg ? "Subtract" : "Add"}
            </button>
          </div>
        </div>
      </section>

      {winner && (
        <div className="scrim">
          <div className="dialog">
            <div className="trophy">🏆</div>
            <h3>{winner.name} wins!</h3>
            <p>{winner.points.toLocaleString()} points in {round} rounds</p>
            <div className="dactions">
              <button className="btn text" onClick={() => { buzz(H.tick); setWinner(null); setDone(true); }}>Keep playing</button>
              <button className="btn filled" onClick={() => { buzz(H.start); onRematch(); }}>Rematch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── App ───────────── */
export default function App() {
  const [players, setPlayers] = useState(() => load("tutto:players", []));
  const [target, setTarget] = useState(() => load("tutto:target", DEFAULT_TARGET));
  const [haptics, setHaptics] = useState(HAPTICS);
  const [toast, setToast] = useState(null);
  const [game, setGame] = useState(0); // 0 = home, otherwise remount key
  const timer = useRef();

  useEffect(() => save("tutto:players", players), [players]);
  useEffect(() => save("tutto:target", target), [target]);

  const say = (msg) => {
    setToast({ msg, k: Math.random() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  };
  const toggleHaptics = () => {
    const n = !haptics;
    HAPTICS = n;
    save("tutto:haptics", n);
    setHaptics(n);
    if (!n) return say("Haptics off");
    let ok = false;
    try { ok = typeof navigator.vibrate === "function" && navigator.vibrate(H.on); } catch { /* ignore */ }
    say(ok ? "Haptics on" : "This browser can't vibrate");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {game === 0 ? (
          <Home players={players} setPlayers={setPlayers} target={target} setTarget={setTarget}
            haptics={haptics} onHaptics={toggleHaptics} onStart={() => setGame(1)} />
        ) : (
          <Game key={game} initial={players} target={target} haptics={haptics} onHaptics={toggleHaptics}
            onHome={() => setGame(0)} onRematch={() => setGame((g) => g + 1)} />
        )}
        {toast && (
          <div className="toast-wrap"><div className="toast" key={toast.k}>{toast.msg}</div></div>
        )}
      </div>
    </>
  );
}

/* ───────────── Styles (Material 3 tokens) ───────────── */
const CSS = `
:root{
  --primary:#6750A4;--on-primary:#fff;--primary-c:#EADDFF;--on-primary-c:#21005D;
  --secondary-c:#E8DEF8;--on-secondary-c:#1D192B;
  --tertiary:#7D5260;--on-tertiary:#fff;--tertiary-c:#FFD8E4;--on-tertiary-c:#31111D;
  --error:#B3261E;--on-error:#fff;--error-c:#F9DEDC;--on-error-c:#410E0B;
  --surface:#FEF7FF;--surface-c:#F3EDF7;--surface-ch:#ECE6F0;--surface-chh:#E6E0E9;
  --on-surface:#1D1B20;--on-surface-v:#49454F;--outline-v:#CAC4D0;
  --inv:#322F35;--on-inv:#F5EFF7;
  --spring:cubic-bezier(.34,1.56,.64,1);
}
@media (prefers-color-scheme:dark){:root{
  --primary:#D0BCFF;--on-primary:#381E72;--primary-c:#4F378B;--on-primary-c:#EADDFF;
  --secondary-c:#4A4458;--on-secondary-c:#E8DEF8;
  --tertiary:#EFB8C8;--on-tertiary:#492532;--tertiary-c:#633B48;--on-tertiary-c:#FFD8E4;
  --error:#F2B8B5;--on-error:#601410;--error-c:#8C1D18;--on-error-c:#F9DEDC;
  --surface:#141218;--surface-c:#211F26;--surface-ch:#2B2930;--surface-chh:#36343B;
  --on-surface:#E6E0E9;--on-surface-v:#CAC4D0;--outline-v:#49454F;
  --inv:#E6E0E9;--on-inv:#322F35;
}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;margin:0}
html,body{overflow:hidden;overscroll-behavior:none}
body{background:var(--surface-c);color:var(--on-surface);-webkit-font-smoothing:antialiased;
  font-family:"Google Sans Flex","Roboto Flex",Roboto,system-ui,sans-serif}
button,input{font:inherit;color:inherit}
button{border:0;cursor:pointer;user-select:none}
.app{position:fixed;inset:0;max-width:480px;margin:0 auto;overflow:hidden;background:var(--surface)}
.screen{position:absolute;inset:0;animation:rise .7s var(--spring) both}
@keyframes rise{from{transform:translateY(40px) scale(.96);opacity:0}}
@keyframes pop{from{transform:scale(.5);opacity:0}}
@keyframes bump{from{transform:scale(.6) translateY(6px);opacity:0}}
@keyframes swap{from{transform:translateY(16px);opacity:0}}
@keyframes out{to{transform:scale(.6);opacity:0}}
@keyframes fade{from{opacity:0}}
@keyframes wobble{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) scale(1.06)}}
.avatar{display:grid;place-items:center;border-radius:36%;font-weight:700;flex:none}
.tag{font-style:normal;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;flex:none;
  background:var(--primary);color:var(--on-primary);animation:pop .5s var(--spring) both}
.tag.ed{background:var(--tertiary);color:var(--on-tertiary)}

.toast-wrap{position:absolute;left:0;right:0;top:max(14px,env(safe-area-inset-top));display:grid;
  place-items:center;z-index:30;pointer-events:none}
.toast{padding:12px 20px;border-radius:20px;background:var(--inv);color:var(--on-inv);font-size:15px;
  font-weight:500;box-shadow:0 6px 20px rgb(0 0 0/.25);animation:pop .5s var(--spring) both}

.home{display:flex;flex-direction:column;gap:16px;overflow-y:auto;
  padding:max(24px,env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))}
.home .hap{position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;z-index:2}
.hero{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 0 0;text-align:center}
.logo{width:80px;height:80px;display:grid;place-items:center;font-size:40px;
  background:var(--primary-c);border-radius:28px;animation:wobble 5s ease-in-out infinite}
.hero h1{margin:6px 0 0;font-size:40px;font-weight:700;letter-spacing:-1px}
.hero p{margin:0;color:var(--on-surface-v)}
.field{display:flex;gap:10px;flex:none}
.field input{flex:1;min-width:0;height:60px;padding:0 22px;border-radius:30px;border:2px solid transparent;
  background:var(--surface-ch);outline:0;font-size:17px;
  transition:border-color .2s,border-radius .5s var(--spring)}
.field input:focus{border-color:var(--primary);border-radius:22px}
.fab{width:60px;height:60px;border-radius:22px;background:var(--primary-c);color:var(--on-primary-c);
  display:grid;place-items:center;transition:transform .5s var(--spring),border-radius .5s var(--spring),opacity .2s}
.fab:active:not(:disabled){transform:scale(.85);border-radius:30px}
.fab:disabled{opacity:.38}

.goal{flex:none;display:flex;flex-direction:column;gap:10px;padding:12px 12px 12px 20px;
  border-radius:28px;background:var(--surface-c)}
.goal-row{display:flex;align-items:center;gap:8px}
.goal-row>span{flex:1;font-weight:500;color:var(--on-surface-v)}
.step{width:44px;height:44px;border-radius:16px;background:var(--primary-c);color:var(--on-primary-c);
  display:grid;place-items:center;transition:transform .5s var(--spring),border-radius .5s var(--spring)}
.step:active{transform:scale(.8);border-radius:22px;transition-duration:.1s}
.goal-v{min-width:84px;text-align:center;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;
  animation:bump .35s var(--spring) both}
.presets{display:flex;gap:8px;padding-right:8px}
.preset{flex:1;height:36px;border-radius:18px;background:var(--surface-chh);font-weight:600;font-size:14px;
  transition:transform .5s var(--spring),background .25s,color .25s}
.preset:active{transform:scale(.9);transition-duration:.1s}
.preset.on{background:var(--secondary-c);color:var(--on-secondary-c)}

.chips{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1;min-height:88px}
.chip{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 10px;border-radius:28px;
  background:var(--surface-ch);animation:pop .55s var(--spring) both}
.chip.leave{animation:out .28s ease-in forwards}
.chip b{flex:1;font-weight:500;font-size:17px}
.empty{text-align:center;color:var(--on-surface-v);padding:24px 0}
.icon-btn{width:44px;height:44px;border-radius:50%;background:transparent;display:grid;place-items:center;
  color:var(--on-surface-v);transition:transform .5s var(--spring),background .2s,opacity .2s}
.icon-btn:active{transform:scale(.78);background:var(--surface-chh)}
.hap{flex:none}
.hap:not(.on){opacity:.5}
.hap.on{background:var(--primary-c);color:var(--on-primary-c)}
.start{flex:none;height:64px;border-radius:32px;background:var(--primary);color:var(--on-primary);font-size:18px;
  font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .5s var(--spring),border-radius .5s var(--spring),background .3s}
.start:active:not(:disabled){transform:scale(.95);border-radius:22px}
.start:disabled{background:var(--surface-chh);color:var(--on-surface-v);opacity:.6;cursor:default}

.scroll{position:absolute;inset:0;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 16px 0;
  transition:padding-bottom .8s var(--spring)}
.top{display:flex;align-items:center;gap:8px;padding:4px 0 16px}
.top .hap{margin-left:auto}
.top h2{margin:0;font-size:32px;font-weight:600;line-height:1.1}
.top span{font-size:14px;color:var(--on-surface-v)}
.list{list-style:none;margin:0;padding:0;position:relative}
.row{padding-bottom:8px}

.card{border-radius:28px;background:var(--surface-c);overflow:hidden;
  transition:background .35s,color .35s}
.card.now{background:var(--primary-c);color:var(--on-primary-c)}
.card.edit{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.main{display:flex;align-items:center;gap:12px;padding:10px 18px 10px 14px;cursor:pointer;
  transition:transform .5s var(--spring)}
.main:active{transform:scale(.975)}
.rank{width:24px;text-align:center;font-weight:600;color:var(--on-surface-v)}
.card.now .rank,.card.edit .rank{color:inherit}
.info{flex:1;min-width:0}
.nm{display:flex;align-items:center;gap:6px;max-width:100%;background:transparent;text-align:left;
  padding:6px 8px 6px 0;margin:-6px 0}
.nm b{font-weight:600;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chev{flex:none;display:grid;opacity:.55;transition:transform .55s var(--spring)}
.card.open .chev{transform:rotate(180deg)}
.track{height:8px;border-radius:4px;margin-top:8px;overflow:hidden;background:color-mix(in srgb,currentColor 14%,transparent)}
.fill{height:100%;border-radius:4px;background:var(--primary);transition:width .9s var(--spring)}
.pts{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}

.hist{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.card.open .hist{grid-template-rows:1fr;transition:grid-template-rows .65s var(--spring)}
.hist-clip{overflow:hidden;min-height:0}
.hist-in{max-height:188px;overflow:auto;padding:2px 14px 14px;display:flex;flex-direction:column;gap:6px}
.ev{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:16px;flex:none;
  background:color-mix(in srgb,currentColor 8%,transparent)}
.card.open .ev{animation:swap .5s var(--spring) both}
.ev .d{min-width:64px;font-weight:700;font-variant-numeric:tabular-nums}
.ev .d.pos{color:var(--primary)}
.ev .d.neg{color:var(--error)}
.ev .meta{flex:1;display:flex;align-items:center;gap:6px;font-size:13px;opacity:.75}
.ev .meta i{font-style:normal;font-size:11px;font-weight:600;padding:1px 7px;border-radius:8px;
  background:color-mix(in srgb,currentColor 14%,transparent)}
.ev .tot{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;opacity:.8}
.none{padding:6px 4px 2px;font-size:14px;opacity:.7;text-align:center}

.sheet{position:absolute;left:0;right:0;bottom:0;height:${SHEET_H}px;background:var(--surface-ch);
  border-radius:32px 32px 0 0;box-shadow:0 -4px 24px rgb(0 0 0/.12);display:flex;flex-direction:column;
  padding:0 16px calc(16px + env(safe-area-inset-bottom));will-change:transform}
.sheet::after{content:"";position:absolute;left:0;right:0;top:100%;height:120px;background:inherit}
.grab{touch-action:none;cursor:grab;padding-top:10px;height:${PEEK}px;flex:none}
.pill{display:block;width:36px;height:5px;border-radius:3px;background:var(--outline-v);margin:0 auto 12px}
.turn{display:flex;align-items:center;gap:12px;animation:swap .6s var(--spring) both}
.who{display:flex;flex-direction:column;flex:1;min-width:0}
.wn{display:flex;align-items:center;gap:8px}
.wn b{font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.who span{font-size:13px;color:var(--on-surface-v)}
.pending{font-size:34px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums;animation:bump .4s var(--spring) both}
.pending.neg{color:var(--error)}
.pending.zero{opacity:.35}

.body{flex:1;min-height:0;display:flex;flex-direction:column;touch-action:pan-y;
  transition:transform .6s var(--spring)}
.seg{position:relative;flex:none;display:grid;grid-template-columns:1fr 1fr;height:44px;padding:4px;
  border-radius:22px;background:var(--surface-chh);margin-bottom:8px}
.seg .ind{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:18px;
  background:var(--primary-c);transition:transform .6s var(--spring),background .3s}
.seg.neg .ind{transform:translateX(100%);background:var(--error-c)}
.seg button{position:relative;z-index:1;background:transparent;font-weight:600;font-size:15px;
  display:flex;align-items:center;justify-content:center;gap:6px;color:var(--on-surface-v);
  transition:color .3s,transform .5s var(--spring)}
.seg button:active{transform:scale(.94)}
.seg button.on{color:var(--on-primary-c)}
.seg.neg button.on{color:var(--on-error-c)}

.pad{flex:1;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr);gap:8px;min-height:0}
.key{border-radius:22px;background:var(--surface-chh);font-size:24px;font-weight:500;display:grid;place-items:center;
  transition:transform .5s var(--spring),border-radius .5s var(--spring),background .2s}
.key:active{transform:scale(.9);border-radius:32px;transition-duration:.1s;background:var(--secondary-c)}
.key.fn{background:var(--secondary-c);color:var(--on-secondary-c)}
.actions{display:grid;grid-template-columns:1fr 1.3fr;gap:8px;margin-top:12px;flex:none}
.btn{height:60px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:8px;
  font-size:17px;font-weight:600;transition:transform .5s var(--spring),border-radius .5s var(--spring),opacity .2s,background .3s,color .3s}
.btn:active:not(:disabled){transform:scale(.93);border-radius:20px}
.btn.tonal{background:var(--tertiary-c);color:var(--on-tertiary-c)}
.btn.sec{background:var(--secondary-c);color:var(--on-secondary-c);font-size:16px;gap:6px}
.btn.pop{animation:pop .5s var(--spring) both}
.btn.filled{background:var(--primary);color:var(--on-primary)}
.btn.filled.neg{background:var(--error);color:var(--on-error)}
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
