
// ─── Stars ───
const starsEl = document.getElementById("stars");
for (let i = 0; i < 100; i++) {
    const s = document.createElement("div"); s.className = "star";
    const sz = Math.random() * 2.5 + .5;
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${sz}px;height:${sz}px;--d:${2 + Math.random() * 4}s;--op:${.3 + Math.random() * .6};animation-delay:${Math.random() * 4}s`;
    starsEl.appendChild(s);
}

// ─── Audio ───
let audioCtx = null, muted = false;
const getAudio = () => { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { }); return audioCtx };
const playSound = t => { if (muted) return; try { const ctx = getAudio(); if (t === "treasure") { [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); const tt = ctx.currentTime + i * .12; g.gain.setValueAtTime(.2, tt); g.gain.exponentialRampToValueAtTime(.001, tt + .5); o.frequency.setValueAtTime(f, tt); o.type = "sine"; o.start(tt); o.stop(tt + .5) }); } else if (t === "danger" || t === "timeout") { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4); o.frequency.setValueAtTime(t === "danger" ? 200 : 180, ctx.currentTime); o.type = "sawtooth"; o.start(); o.stop(ctx.currentTime + .4); } else { const d = { empty: [220, "sawtooth", .1, .3], turn: [660, "sine", .08, .15], tick: [800, "sine", .05, .05], taunt: [440, "square", .08, .2], streak: [880, "sine", .12, .3] }; const [f, w, v, dr] = d[t] || [440, "sine", .12, .1]; const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(v, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dr); o.frequency.setValueAtTime(f, ctx.currentTime); o.type = w; o.start(); o.stop(ctx.currentTime + dr); } } catch (e) { } };

// ─── State ───
const TOTAL = 25, TURN_SEC = 15, TAUNTS = ["😂", "💀", "🔥", "👀", "🤯", "🎯"];
let board = [], cp = 1, scores = { 1: 0, 2: 0 }, streaks = { 1: 0, 2: 0 };
let tilesLeft = 25, winner = null, locked = false;
let matchMode = 3, timerOn = true, tInt = null, timeLeft = TURN_SEC;
let round = 1, dangerMode = false, names = { 1: "Captain Blue", 2: "Captain Red" };

const genBoard = () => { const idx = Math.floor(Math.random() * TOTAL); return Array.from({ length: TOTAL }, (_, i) => ({ id: i, opened: false, hasTreasure: i === idx, el: null })) };

// ─── Screen ───
const showScreen = id => { document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); document.getElementById(id).classList.add("active") };

// ─── Timer ───
const stopTmr = () => { clearInterval(tInt); tInt = null };
const startTmr = () => {
    stopTmr(); timeLeft = TURN_SEC; updateTmrBar();
    tInt = setInterval(() => {
        timeLeft--; updateTmrBar();
        if (timeLeft <= 3 && timeLeft > 0) playSound("tick");
        if (timeLeft <= 0) { stopTmr(); if (!locked) { playSound("timeout"); locked = true; setTimeout(() => { switchP(); locked = false; if (timerOn && !winner) startTmr(); }, 500); } }
    }, 1000);
};
const updateTmrBar = () => {
    const fill = document.getElementById("timer-fill");
    const pct = (timeLeft / TURN_SEC) * 100;
    const color = timeLeft <= 5 ? "#EF4444" : timeLeft <= 9 ? "#F59E0B" : "#3B82F6";
    fill.style.width = pct + "%"; fill.style.background = color; fill.style.boxShadow = `0 0 8px ${color}`;
    [1, 2].forEach(p => {
        const el = document.getElementById(`p${p}-tm`); if (!el) return;
        if (cp === p && timerOn && !winner) { const urg = timeLeft <= 5; el.textContent = `⏱ ${timeLeft}s`; el.className = "ptimer" + (urg ? " urgent" : ""); } else el.textContent = "";
    });
};

// ─── UI ───
const updateCards = () => {
    [1, 2].forEach(p => {
        const card = document.getElementById(`p${p}-card`);
        card.className = `pcard p${p}${(cp === p && !winner) ? " active" : ""}`;
        document.getElementById(`p${p}-sc`).textContent = `🏆 ${scores[p]}`;
        const sb = document.getElementById(`p${p}-stk`);
        if (streaks[p] >= 2) { sb.style.display = "flex"; sb.textContent = `${streaks[p]}🔥`; } else sb.style.display = "none";
    });
};
const updatePill = () => {
    const pill = document.getElementById("turn-pill");
    const c = cp === 1 ? "rgba(59,130,246,.15)" : "rgba(239,68,68,.15)";
    const b = cp === 1 ? "rgba(59,130,246,.5)" : "rgba(239,68,68,.5)";
    const g = cp === 1 ? "rgba(59,130,246,.28)" : "rgba(239,68,68,.28)";
    const d = cp === 1 ? "#3B82F6" : "#EF4444";
    pill.style.cssText = `display:inline-flex;align-items:center;gap:8px;border-radius:99px;padding:8px 24px;font-size:14px;font-weight:700;color:white;border:1px solid ${b};background:${c};box-shadow:0 0 20px ${g};animation:turn-flash .4s ease`;
    pill.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;background:${d};display:inline-block"></span>${names[cp]}'s Turn`;
};
const updatePips = () => {
    const target = Math.ceil(matchMode / 2);
    const mp = document.getElementById("mpips");
    if (matchMode === 1) { mp.style.display = "none"; return; }
    mp.style.display = "flex";
    document.getElementById("mpips-lbl").textContent = `BEST OF ${matchMode} · ROUND ${round}`;
    const wrap = document.getElementById("pips-wrap"); wrap.innerHTML = "";
    for (let i = 0; i < target; i++) {
        const col = document.createElement("div"); col.className = "pip-col";
        [1, 2].forEach(p => { const pip = document.createElement("div"); pip.className = "pip"; pip.style.background = i < scores[p] ? (p === 1 ? "#3B82F6" : "#EF4444") : "rgba(255,255,255,.1)"; col.appendChild(pip); });
        wrap.appendChild(col);
    }
};
const updateTiles = () => {
    document.getElementById("tiles-disp").textContent = tilesLeft;
    document.getElementById("tiles-disp").className = "stat-big" + (tilesLeft <= 5 ? " red" : "");
    document.getElementById("bb-tiles").textContent = tilesLeft;
    document.getElementById("bb-tiles").className = "bb-val" + (tilesLeft <= 5 ? " red" : "");
};
const checkDanger = () => {
    const b = document.getElementById("danger-banner");
    if (tilesLeft <= 5 && tilesLeft > 0 && !winner) {
        if (!dangerMode) { dangerMode = true; playSound("danger"); }
        document.getElementById("dnr-cnt").textContent = tilesLeft; b.style.display = "block";
    } else { dangerMode = false; b.style.display = "none"; }
};

// ─── Build board ───
const buildBoard = () => {
    const el = document.getElementById("board"); el.innerHTML = "";
    board.forEach(tile => {
        const div = document.createElement("div"); div.className = "tile";
        div.innerHTML = `<span>?</span>`;
        div.addEventListener("click", () => handleTile(tile.id));
        tile.el = div; el.appendChild(div);
    });
};
const buildTaunts = () => {
    const wrap = document.getElementById("taunt-btns"); wrap.innerHTML = "";
    TAUNTS.forEach(e => {
        const btn = document.createElement("button"); btn.className = "taunt-btn"; btn.textContent = e;
        btn.addEventListener("click", () => { getAudio(); playSound("taunt"); const ov = document.getElementById("taunt-ov"); ov.textContent = e; ov.style.display = "block"; setTimeout(() => ov.style.display = "none", 1300); });
        wrap.appendChild(btn);
    });
};

// ─── Switch player ───
const switchP = () => { cp = cp === 1 ? 2 : 1; updateCards(); updatePill(); playSound("turn"); };

// ─── Tile click ───
const handleTile = id => {
    if (locked || winner) return;
    const tile = board[id]; if (!tile || tile.opened) return;
    locked = true; stopTmr(); getAudio(); tile.opened = true;
    if (tile.hasTreasure) {
        tile.el.className = "tile treasure"; tile.el.innerHTML = `<span style="filter:drop-shadow(0 0 8px #FFD700)">🏆</span>`;
        playSound("treasure"); fireParticles();
        setTimeout(() => {
            tilesLeft--; const w = cp; scores[w]++; streaks[w]++; streaks[w === 1 ? 2 : 1] = 0;
            if (streaks[w] >= 2) playSound("streak"); winner = w; updateCards(); updateTiles(); showWinner();
        }, 800);
    } else {
        tile.el.className = "tile opening"; tile.el.innerHTML = `<span>💨</span>`; playSound("empty");
        tilesLeft--; updateTiles(); checkDanger();
        setTimeout(() => { tile.el.className = "tile gone"; tile.el.innerHTML = ""; switchP(); locked = false; if (timerOn && !winner) startTmr(); }, 500);
    }
};

// ─── Winner modal ───
const showWinner = () => {
    stopTmr(); const target = Math.ceil(matchMode / 2);
    const matchOver = scores[1] >= target || scores[2] >= target;
    const mw = scores[1] >= target ? 1 : 2;
    document.getElementById("w-title").textContent = matchOver ? `${names[mw]} WINS THE MATCH!` : `${names[winner]} WINS THE ROUND!`;
    document.getElementById("w-sub").textContent = matchOver ? "🎉 Champion of the Seven Seas!" : "Found the hidden treasure chest!";
    document.getElementById("w-scores").innerHTML = [1, 2].map(p => `<div class="w-sc${p === winner ? " win" : ""}"><div class="w-sc-nm">${names[p]}</div><div class="w-sc-n" style="color:${p === winner ? "#FFD700" : "white"}">${scores[p]}</div>${streaks[p] >= 2 ? `<div style="font-size:11px;color:#FF6B35">🔥 ${streaks[p]} streak</div>` : ""}</div>`).join("");
    const wp = document.getElementById("w-pips");
    if (matchMode > 1) { wp.style.display = "flex"; wp.innerHTML = ""; for (let i = 0; i < target; i++) { const col = document.createElement("div"); col.style.cssText = "display:flex;flex-direction:column;gap:3px";[1, 2].forEach(p => { const d = document.createElement("div"); d.style.cssText = `width:14px;height:14px;border-radius:3px;background:${i < scores[p] ? (p === 1 ? "#3B82F6" : "#EF4444") : "rgba(255,255,255,.1)"}`; col.appendChild(d); }); wp.appendChild(col); } } else wp.style.display = "none";
    document.getElementById("btn-rm").textContent = matchOver ? "🔄 NEW MATCH" : "⚔️ NEXT ROUND";
    document.getElementById("winner-ov").classList.add("show");
};

// ─── Particles ───
const fireParticles = () => {
    const wrap = document.getElementById("particles");
    const cols = ["#FFD700", "#FFA500", "#FF6B35", "#FFE44D", "#FFF", "#E040FB", "#2196F3"];
    for (let i = 0; i < 30; i++) { const p = document.createElement("div"); p.className = "particle"; const sz = Math.random() * 10 + 4, dx = (Math.random() - .5) * 300, dy = -(Math.random() * 200 + 50); p.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${sz}px;height:${sz}px;background:${cols[i % cols.length]};--dx:${dx}px;--dy:${dy}px;animation-delay:${Math.random() * .5}s`; wrap.appendChild(p); }
    setTimeout(() => wrap.innerHTML = "", 2500);
};

// ─── Start game ───
const startGame = () => {
    names[1] = document.getElementById("p1-name").value.trim() || "Captain Blue";
    names[2] = document.getElementById("p2-name").value.trim() || "Captain Red";
    document.getElementById("p1-nm").textContent = names[1]; document.getElementById("p2-nm").textContent = names[2];
    scores = { 1: 0, 2: 0 }; streaks = { 1: 0, 2: 0 }; round = 1; cp = 1; winner = null; locked = false; dangerMode = false;
    board = genBoard(); tilesLeft = TOTAL;
    document.getElementById("bb-match").textContent = matchMode === 1 ? "Single" : `Best of ${matchMode}`;
    document.getElementById("rnd-disp").textContent = 1;
    document.getElementById("danger-banner").style.display = "none";
    document.getElementById("timer-wrap").style.opacity = timerOn ? "1" : "0";
    buildBoard(); buildTaunts(); updateCards(); updatePill(); updateTiles(); updatePips();
    showScreen("game-screen"); if (timerOn) startTmr();
};

// ─── Rematch ───
const handleRematch = () => {
    const target = Math.ceil(matchMode / 2); const matchOver = scores[1] >= target || scores[2] >= target;
    if (matchOver) { scores = { 1: 0, 2: 0 }; streaks = { 1: 0, 2: 0 }; round = 1; } else round++;
    cp = 1; winner = null; locked = false; dangerMode = false; board = genBoard(); tilesLeft = TOTAL;
    document.getElementById("rnd-disp").textContent = round;
    document.getElementById("danger-banner").style.display = "none";
    document.getElementById("winner-ov").classList.remove("show");
    buildBoard(); updateCards(); updatePill(); updateTiles(); updatePips();
    if (timerOn) startTmr();
};
const handleLeave = () => { stopTmr(); winner = null; locked = false; document.getElementById("winner-ov").classList.remove("show"); showScreen("lobby-screen"); };

// ─── Controls ───
let selMode = 3;
document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => { document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("on")); btn.classList.add("on"); selMode = parseInt(btn.dataset.m); matchMode = selMode; });
});
let tmrEnabled = true;
document.getElementById("tmr-toggle").addEventListener("click", () => {
    tmrEnabled = !tmrEnabled; timerOn = tmrEnabled;
    document.getElementById("tmr-track").className = "t-track" + (tmrEnabled ? " on" : "");
    document.getElementById("timer-wrap").style.opacity = tmrEnabled ? "1" : "0";
});
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("back-btn").addEventListener("click", handleLeave);
document.getElementById("btn-rm").addEventListener("click", handleRematch);
document.getElementById("btn-lv").addEventListener("click", handleLeave);
document.getElementById("mute-btn").addEventListener("click", () => { muted = !muted; document.getElementById("mute-btn").textContent = muted ? "🔇" : "🔊"; });
