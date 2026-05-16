// ─── Stars (one-time setup) ───
const starsEl = document.getElementById("stars");
const frag = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const sz = Math.random() * 2.5 + 0.5;
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;--d:${2+Math.random()*4}s;--op:${0.3+Math.random()*0.6};animation-delay:${Math.random()*4}s`;
    frag.appendChild(s);
}
starsEl.appendChild(frag);

// ─── Audio ───
let audioCtx = null, muted = false;

const getAudio = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
};

// Lookup table: type → [freq, waveform, gain, duration]
const SOUND_DEFS = {
    empty:   [220,  "sawtooth", 0.10, 0.30],
    turn:    [660,  "sine",     0.08, 0.15],
    tick:    [800,  "sine",     0.05, 0.05],
    taunt:   [440,  "square",   0.08, 0.20],
    streak:  [880,  "sine",     0.12, 0.30],
    danger:  [200,  "sawtooth", 0.15, 0.40],
    timeout: [180,  "sawtooth", 0.15, 0.40],
};

const playTone = (freq, wave, gain, duration, ctx, delay = 0) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.frequency.setValueAtTime(freq, t);
    o.type = wave;
    o.start(t); o.stop(t + duration);
};

const playSound = type => {
    if (muted) return;
    try {
        const ctx = getAudio();
        if (type === "treasure") {
            [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.2, 0.5, ctx, i * 0.12));
            return;
        }
        const def = SOUND_DEFS[type];
        if (def) playTone(...def, ctx);
    } catch (_) {}
};

// ─── Constants ───
const TOTAL    = 25;
const TURN_SEC = 15;
const TAUNTS   = ["😂", "💀", "🔥", "👀", "🤯", "🎯"];

// ─── Game state (single source of truth) ───
const state = {
    board:      [],
    cp:         1,
    scores:     { 1: 0, 2: 0 },
    streaks:    { 1: 0, 2: 0 },
    tilesLeft:  TOTAL,
    winner:     null,
    locked:     false,
    matchMode:  3,
    timerOn:    true,
    timeLeft:   TURN_SEC,
    round:      1,
    dangerMode: false,
    names:      { 1: "Captain Blue", 2: "Captain Red" },
};

// Reusable tile DOM elements (built once, reset each round)
let tileEls = [];

// ─── Board generation ───
const genBoard = () => {
    const treasure = Math.floor(Math.random() * TOTAL);
    return Array.from({ length: TOTAL }, (_, i) => ({
        id: i,
        opened: false,
        hasTreasure: i === treasure,
    }));
};

// ─── Screen ───
const showScreen = id => {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
};

// ─── Timer ───
let tInt = null;

const stopTmr = () => { clearInterval(tInt); tInt = null; };

const startTmr = () => {
    stopTmr();
    state.timeLeft = TURN_SEC;
    updateTimerBar();
    tInt = setInterval(() => {
        state.timeLeft--;
        updateTimerBar();
        if (state.timeLeft <= 3 && state.timeLeft > 0) playSound("tick");
        if (state.timeLeft <= 0) {
            stopTmr();
            if (!state.locked) {
                playSound("timeout");
                state.locked = true;
                setTimeout(() => {
                    switchPlayer();
                    state.locked = false;
                    if (state.timerOn && !state.winner) startTmr();
                }, 500);
            }
        }
    }, 1000);
};

const updateTimerBar = () => {
    const fill = document.getElementById("timer-fill");
    const pct  = (state.timeLeft / TURN_SEC) * 100;
    const color = state.timeLeft <= 5 ? "#EF4444" : state.timeLeft <= 9 ? "#F59E0B" : "#3B82F6";
    fill.style.width      = pct + "%";
    fill.style.background = color;
    fill.style.boxShadow  = `0 0 8px ${color}`;

    [1, 2].forEach(p => {
        const el = document.getElementById(`p${p}-tm`);
        if (!el) return;
        if (state.cp === p && state.timerOn && !state.winner) {
            const urgent = state.timeLeft <= 5;
            el.textContent = `⏱ ${state.timeLeft}s`;
            el.className = "ptimer" + (urgent ? " urgent" : "");
        } else {
            el.textContent = "";
        }
    });
};

// ─── Consolidated render ───
// Call this whenever state changes — no more scattered individual update calls.
const render = () => {
    updateCards();
    updatePill();
    updateTiles();
    updatePips();
    checkDanger();
};

const updateCards = () => {
    [1, 2].forEach(p => {
        const card = document.getElementById(`p${p}-card`);
        card.className = `pcard p${p}${(state.cp === p && !state.winner) ? " active" : ""}`;
        document.getElementById(`p${p}-sc`).textContent = `🏆 ${state.scores[p]}`;
        const sb = document.getElementById(`p${p}-stk`);
        if (state.streaks[p] >= 2) {
            sb.style.display  = "flex";
            sb.textContent    = `${state.streaks[p]}🔥`;
        } else {
            sb.style.display  = "none";
        }
    });
};

const updatePill = () => {
    const pill = document.getElementById("turn-pill");
    const c = state.cp === 1 ? "rgba(59,130,246,.15)" : "rgba(239,68,68,.15)";
    const b = state.cp === 1 ? "rgba(59,130,246,.5)"  : "rgba(239,68,68,.5)";
    const g = state.cp === 1 ? "rgba(59,130,246,.28)" : "rgba(239,68,68,.28)";
    const d = state.cp === 1 ? "#3B82F6"              : "#EF4444";
    pill.style.cssText = `display:inline-flex;align-items:center;gap:8px;border-radius:99px;padding:8px 24px;font-size:14px;font-weight:700;color:white;border:1px solid ${b};background:${c};box-shadow:0 0 20px ${g};animation:turn-flash .4s ease`;
    pill.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;background:${d};display:inline-block"></span>${state.names[state.cp]}'s Turn`;
};

const updatePips = () => {
    const target = Math.ceil(state.matchMode / 2);
    const mp = document.getElementById("mpips");
    if (state.matchMode === 1) { mp.style.display = "none"; return; }
    mp.style.display = "flex";
    document.getElementById("mpips-lbl").textContent = `BEST OF ${state.matchMode} · ROUND ${state.round}`;
    const wrap = document.getElementById("pips-wrap");
    wrap.innerHTML = "";
    const colFrag = document.createDocumentFragment();
    for (let i = 0; i < target; i++) {
        const col = document.createElement("div");
        col.className = "pip-col";
        [1, 2].forEach(p => {
            const pip = document.createElement("div");
            pip.className = "pip";
            pip.style.background = i < state.scores[p]
                ? (p === 1 ? "#3B82F6" : "#EF4444")
                : "rgba(255,255,255,.1)";
            col.appendChild(pip);
        });
        colFrag.appendChild(col);
    }
    wrap.appendChild(colFrag);
};

const updateTiles = () => {
    const cls = "stat-big" + (state.tilesLeft <= 5 ? " red" : "");
    document.getElementById("tiles-disp").textContent  = state.tilesLeft;
    document.getElementById("tiles-disp").className    = cls;
    document.getElementById("bb-tiles").textContent    = state.tilesLeft;
    document.getElementById("bb-tiles").className      = "bb-val" + (state.tilesLeft <= 5 ? " red" : "");
};

const checkDanger = () => {
    const b = document.getElementById("danger-banner");
    if (state.tilesLeft <= 5 && state.tilesLeft > 0 && !state.winner) {
        if (!state.dangerMode) { state.dangerMode = true; playSound("danger"); }
        document.getElementById("dnr-cnt").textContent = state.tilesLeft;
        b.style.display = "block";
    } else {
        state.dangerMode = false;
        b.style.display  = "none";
    }
};

// ─── Board: build once, reset per round ───
const buildBoard = () => {
    const el = document.getElementById("board");

    if (tileEls.length === 0) {
        // First build: create elements and cache them
        el.innerHTML = "";
        const boardFrag = document.createDocumentFragment();
        for (let i = 0; i < TOTAL; i++) {
            const div = document.createElement("div");
            div.className = "tile";
            div.innerHTML = "<span>?</span>";
            div.addEventListener("click", () => handleTile(i));
            tileEls.push(div);
            boardFrag.appendChild(div);
        }
        el.appendChild(boardFrag);
    } else {
        // Subsequent rounds: just reset appearance
        tileEls.forEach(div => {
            div.className = "tile";
            div.innerHTML = "<span>?</span>";
        });
    }

    // Sync tile el references into board state
    state.board.forEach((tile, i) => { tile.el = tileEls[i]; });
};

const buildTaunts = () => {
    const wrap = document.getElementById("taunt-btns");
    if (wrap.children.length > 0) return; // Build once
    TAUNTS.forEach(e => {
        const btn = document.createElement("button");
        btn.className   = "taunt-btn";
        btn.textContent = e;
        btn.addEventListener("click", () => {
            getAudio();
            playSound("taunt");
            const ov = document.getElementById("taunt-ov");
            ov.textContent    = e;
            ov.style.display  = "block";
            setTimeout(() => { ov.style.display = "none"; }, 1300);
        });
        wrap.appendChild(btn);
    });
};

// ─── Switch player ───
const switchPlayer = () => {
    state.cp = state.cp === 1 ? 2 : 1;
    updateCards();
    updatePill();
    playSound("turn");
};

// ─── Tile click ───
const handleTile = id => {
    if (state.locked || state.winner) return;
    const tile = state.board[id];
    if (!tile || tile.opened) return;

    state.locked = true;
    stopTmr();
    getAudio();
    tile.opened = true;

    if (tile.hasTreasure) {
        tile.el.className = "tile treasure";
        tile.el.innerHTML = `<span style="filter:drop-shadow(0 0 8px #FFD700)">🏆</span>`;
        playSound("treasure");
        fireParticles();
        setTimeout(() => {
            state.tilesLeft--;
            const w = state.cp;
            state.scores[w]++;
            state.streaks[w]++;
            state.streaks[w === 1 ? 2 : 1] = 0;
            if (state.streaks[w] >= 2) playSound("streak");
            state.winner = w;
            render();
            showWinner();
        }, 800);
    } else {
        tile.el.className = "tile opening";
        tile.el.innerHTML = "<span>💨</span>";
        playSound("empty");
        state.tilesLeft--;
        render();
        setTimeout(() => {
            tile.el.className = "tile gone";
            tile.el.innerHTML = "";
            switchPlayer();
            state.locked = false;
            if (state.timerOn && !state.winner) startTmr();
        }, 500);
    }
};

// ─── Winner modal ───
const showWinner = () => {
    stopTmr();
    const target    = Math.ceil(state.matchMode / 2);
    const matchOver = state.scores[1] >= target || state.scores[2] >= target;
    const mw        = state.scores[1] >= target ? 1 : 2;

    document.getElementById("w-title").textContent = matchOver
        ? `${state.names[mw]} WINS THE MATCH!`
        : `${state.names[state.winner]} WINS THE ROUND!`;
    document.getElementById("w-sub").textContent = matchOver
        ? "🎉 Champion of the Seven Seas!"
        : "Found the hidden treasure chest!";

    document.getElementById("w-scores").innerHTML = [1, 2].map(p =>
        `<div class="w-sc${p === state.winner ? " win" : ""}">
            <div class="w-sc-nm">${state.names[p]}</div>
            <div class="w-sc-n" style="color:${p === state.winner ? "#FFD700" : "white"}">${state.scores[p]}</div>
            ${state.streaks[p] >= 2 ? `<div style="font-size:11px;color:#FF6B35">🔥 ${state.streaks[p]} streak</div>` : ""}
        </div>`
    ).join("");

    const wp = document.getElementById("w-pips");
    if (state.matchMode > 1) {
        wp.style.display = "flex";
        wp.innerHTML     = "";
        for (let i = 0; i < target; i++) {
            const col = document.createElement("div");
            col.style.cssText = "display:flex;flex-direction:column;gap:3px";
            [1, 2].forEach(p => {
                const d = document.createElement("div");
                d.style.cssText = `width:14px;height:14px;border-radius:3px;background:${i < state.scores[p] ? (p === 1 ? "#3B82F6" : "#EF4444") : "rgba(255,255,255,.1)"}`;
                col.appendChild(d);
            });
            wp.appendChild(col);
        }
    } else {
        wp.style.display = "none";
    }

    document.getElementById("btn-rm").textContent = matchOver ? "🔄 NEW MATCH" : "⚔️ NEXT ROUND";
    document.getElementById("winner-ov").classList.add("show");
};

// ─── Particles ───
const PARTICLE_COLS = ["#FFD700","#FFA500","#FF6B35","#FFE44D","#FFF","#E040FB","#2196F3"];

const fireParticles = () => {
    const wrap = document.getElementById("particles");
    const pFrag = document.createDocumentFragment();
    for (let i = 0; i < 30; i++) {
        const p   = document.createElement("div");
        p.className = "particle";
        const sz  = Math.random() * 10 + 4;
        const dx  = (Math.random() - 0.5) * 300;
        const dy  = -(Math.random() * 200 + 50);
        p.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${PARTICLE_COLS[i % PARTICLE_COLS.length]};--dx:${dx}px;--dy:${dy}px;animation-delay:${Math.random()*0.5}s`;
        pFrag.appendChild(p);
    }
    wrap.appendChild(pFrag);
    setTimeout(() => { wrap.innerHTML = ""; }, 2500);
};

// ─── Reset state for a new round/match ───
const resetRound = (fullReset = false) => {
    if (fullReset) {
        state.scores  = { 1: 0, 2: 0 };
        state.streaks = { 1: 0, 2: 0 };
        state.round   = 1;
    }
    state.cp         = 1;
    state.winner     = null;
    state.locked     = false;
    state.dangerMode = false;
    state.board      = genBoard();
    state.tilesLeft  = TOTAL;
};

// ─── Start game ───
const startGame = () => {
    state.names[1] = document.getElementById("p1-name").value.trim() || "Captain Blue";
    state.names[2] = document.getElementById("p2-name").value.trim() || "Captain Red";
    document.getElementById("p1-nm").textContent = state.names[1];
    document.getElementById("p2-nm").textContent = state.names[2];

    resetRound(true);
    document.getElementById("bb-match").textContent = state.matchMode === 1 ? "Single" : `Best of ${state.matchMode}`;
    document.getElementById("rnd-disp").textContent  = 1;
    document.getElementById("timer-wrap").style.opacity = state.timerOn ? "1" : "0";

    buildBoard();
    buildTaunts();
    render();
    showScreen("game-screen");
    if (state.timerOn) startTmr();
};

// ─── Rematch ───
const handleRematch = () => {
    const target    = Math.ceil(state.matchMode / 2);
    const matchOver = state.scores[1] >= target || state.scores[2] >= target;
    resetRound(matchOver);
    if (!matchOver) state.round++;
    document.getElementById("rnd-disp").textContent = state.round;
    document.getElementById("winner-ov").classList.remove("show");
    buildBoard();
    render();
    if (state.timerOn) startTmr();
};

const handleLeave = () => {
    stopTmr();
    state.winner = null;
    state.locked = false;
    document.getElementById("winner-ov").classList.remove("show");
    showScreen("lobby-screen");
};

// ─── Controls ───
let selMode = 3;
document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        selMode = parseInt(btn.dataset.m, 10);
        state.matchMode = selMode;
    });
});

let tmrEnabled = true;
document.getElementById("tmr-toggle").addEventListener("click", () => {
    tmrEnabled = !tmrEnabled;
    state.timerOn = tmrEnabled;
    document.getElementById("tmr-track").className      = "t-track" + (tmrEnabled ? " on" : "");
    document.getElementById("timer-wrap").style.opacity = tmrEnabled ? "1" : "0";
});

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("back-btn").addEventListener("click", handleLeave);
document.getElementById("btn-rm").addEventListener("click", handleRematch);
document.getElementById("btn-lv").addEventListener("click", handleLeave);
document.getElementById("mute-btn").addEventListener("click", () => {
    muted = !muted;
    document.getElementById("mute-btn").textContent = muted ? "🔇" : "🔊";
});
