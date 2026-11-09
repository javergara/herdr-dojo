// Herdr Dojo: learn Herdr by doing it. A floating window with short lessons; each one asks for a real action
// (make a space, split a pane...) and notices when you've done it by reading Herdr's live state, so it works
// with whatever shortcuts you have bound. Shortcuts shown are read from your own keys.json.
//
// Open it with `mod.open:dojo` (bind a key, or find "mod.open" in the command palette).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, agents, machines, keys, theme, settings, run, props, closeOverlay, openOverlay, appHome, exec } from "herdr";
import * as fs from "fs/promises";
import { CHAPTERS, practiceOf, demoOf, worktrees } from "./lessons.js";
import { ES } from "./es.js";

const STORE = "dojo.v2";
const LESSONS = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.id, chapterTitle: c.title })));
const GOLD = "#e3b341", SILVER = "#aab4c2";

const EN = {
  yourShortcut: "YOUR SHORTCUT", yourTurn: "YOUR TURN", hintLabel: "HINT", start: "Start", next: "Next lesson →", replay: "Replay",
  doit: "Do it for me", hint: "Hint", skip: "Skip", or: "or", settingUp: "Setting things up…", doneIn: "Done in {t}",
  noKey: "No key is bound to this. Use the command palette, or bind one in keys.json.",
  chapterOf: "Chapter {n} of {m} · {t}", chapterHead: "CHAPTER {n} · {t}", allDone: "All chapters complete · {t} in total",
  practice: "Practice", cleanup: "Clean up", reallyCleanup: "Really clean up?", reset: "Reset progress", reallyReset: "Really reset?",
  skipped: "skipped", trophies: "TROPHIES", cleanupNote: "Clean up closes the practice and scratch-repo spaces and removes what the Dojo made.",
};

const snap = (st, mods) => {
  const ag = agents();
  const th = theme();
  let look = "";
  try { look = JSON.stringify(settings()); } catch {}
  return {
    spaces: spaces(), panes: panes().map((p) => ({ pane: p.pane, tab: p.tab })), focused: focused(),
    agents: ag.length, agentList: ag.map((a) => ({ address: a.address, app: a.app, status: a.status, pinned: a.pinned })),
    practice: st.practice ?? null, sandbox: st.sandboxSpace ?? null,
    look, themeSig: [th.background, th.foreground, th.accent].join("|"),
    keysSig: keys().map((k) => `${k.section}:${k.keys}=${k.action}`).sort().join("\n"),
    machines: machines().filter((m) => m.name).map((m) => m.name), mods: mods ?? [],
  };
};

const readStore = () => {
  const base = { done: {}, practice: null, sandboxSpace: null, lang: "en", cur: null };
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...base, ...JSON.parse(raw) };
    // first run after the update: bring over what was done in version 1 (lesson ids did not change)
    const old = JSON.parse(localStorage.getItem("dojo.v1") ?? "null");
    if (old?.done) {
      const done = {};
      for (const [id, d] of Object.entries(old.done)) done[id] = { ms: d.ms ?? 0, best: d.best ?? d.ms ?? 0, helped: true, medal: null, skipped: Boolean(d.skipped) };
      return { ...base, done, practice: old.practice ?? null };
    }
  } catch {}
  return base;
};
const writeStore = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {} };

// "cmd-shift-]" -> ["Cmd", "Shift", "]". Modifiers come first; the rest is the key (which may itself be "-" or "+").
const MODS = ["cmd", "ctrl", "alt", "shift", "super", "opt", "option", "meta"];
const KEYNAME = { left: "←", right: "→", up: "↑", down: "↓", enter: "Enter", tab: "Tab", escape: "Esc", space: "Space", pageup: "PgUp", pagedown: "PgDn", backspace: "⌫", delete: "Del" };
const caps = (combo) => {
  const out = [];
  let rest = String(combo);
  for (;;) {
    const m = MODS.find((x) => rest.toLowerCase().startsWith(x + "-") && rest.length > x.length + 1);
    if (!m) break;
    out.push(m[0].toUpperCase() + m.slice(1));
    rest = rest.slice(m.length + 1);
  }
  out.push(KEYNAME[rest.toLowerCase()] ?? (rest.length === 1 ? rest.toUpperCase() : rest));
  return out;
};
const bindingsFor = (action) => {
  const rank = (s) => (s === "global" ? 0 : s.startsWith("layout:") ? 1 : 2);
  return keys().filter((k) => k.action === action).sort((a, b) => rank(a.section) - rank(b.section)).slice(0, 2).map((k) => k.keys);
};
const fmtMs = (ms) => (ms < 10000 ? `${(ms / 1000).toFixed(1)}s` : ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
const fill = (text, vars) => Object.entries(vars).reduce((t, [k, v]) => t.replace(`{${k}}`, v), text);

const SCRATCH = () => `${appHome()}/data/dojo/scratch-repo`;
const PRACTICE_MOD = () => `${appHome()}/mods/dojo-practice`;

export default class Dojo extends View {
  init(_props, cx) {
    this.store = readStore();
    this.mods = [];
    this.cur = this.store.cur ? { ...this.store.cur, ms: null } : null; // the lesson in progress: { idx, start, step, t0, ms }
    this.pending = null; // a lesson being set up: { idx, at }
    this.adopt = null; // a space we just asked for: { key, from }
    this.launched = {};
    this.confirm = null;
    this.hints = {};
    this.helped = this.cur?.helped ?? false;
    this.openIdx = this.cur?.idx ?? null;
    this.openChapter = null;
    this.modsAt = 0;
    cx.timer.every(400, (cx) => this.tick(cx));
  }

  // ---- text ----
  ui(k, vars) { const t = (this.store.lang === "es" ? ES.ui[k] : null) ?? EN[k] ?? k; return vars ? fill(t, vars) : t; }
  lt(l) {
    const es = this.store.lang === "es" ? ES.lessons[l.id] : null;
    return { title: es?.title ?? l.title, teach: es?.teach ?? l.teach, steps: l.steps.map((s, i) => es?.steps?.[i] ?? s.text), hints: es?.hints ?? l.hints ?? [], primary: es?.primary ?? l.primary, manual: es?.manual ?? l.manual };
  }
  chapterTitle(id) { const c = CHAPTERS.find((x) => x.id === id); return (this.store.lang === "es" ? ES.chapters[id] : null) ?? c.title; }

  save() { writeStore(this.store); }
  firstUndone() { const i = LESSONS.findIndex((l) => !this.store.done[l.id]); return i === -1 ? LESSONS.length : i; }
  state() { return snap(this.store, this.mods); }
  api() { return { run, openOverlay, exec, appHome }; }

  // ---- lesson lifecycle ----
  start(idx, cx) {
    const l = LESSONS[idx];
    this.confirm = null;
    this.openIdx = idx;
    this.openChapter = l.chapter;
    this.helped = false;
    this.hints[l.id] = 0;
    this.launched = {};
    this.adopt = null;
    this.pending = { idx, at: Date.now() };
    this.cur = null;
    this.store.cur = null;
    const s = this.state();
    const p = practiceOf(s);
    if (l.needsPractice !== false) {
      if (!p) { this.adopt = { key: "practice", from: s.spaces.map((x) => x.id) }; run("space.new", { name: "Dojo practice" }); }
      else {
        if (!p.active) run("space.select", { id: p.id });
        for (let i = p.tabs.length; i < (l.minTabs ?? 0); i++) run("tab.new", { space: p.id });
        const have = p.tabs.reduce((n, t) => n + t.panes, 0);
        for (let i = have; i < (l.minPanes ?? 0); i++) run("pane.split", { direction: "right" });
      }
    }
    if ((l.minSpaces ?? 0) > s.spaces.length) run("space.new", {});
    if (l.needsSandbox && !(s.sandbox && s.spaces.some((x) => x.id === s.sandbox))) this.makeSandbox(cx);
    cx.notify();
  }

  // A tiny git repo of our own for the worktree lessons: never a real project.
  makeSandbox(cx) {
    cx.spawn(async (cx) => {
      try {
        const dir = SCRATCH();
        await fs.mkdir(dir, { recursive: true });
        const has = await exec("test", ["-d", `${dir}/.git`]);
        if (has.code !== 0) {
          let r = await exec("git", ["init", "-q", "-b", "main"], { cwd: dir });
          if (r.code !== 0) await exec("git", ["init", "-q"], { cwd: dir });
          await fs.writeFile(`${dir}/README.md`, "# Dojo scratch repo\n\nMade by Herdr Dojo for practice. Safe to delete.\n");
          await exec("git", ["add", "-A"], { cwd: dir });
          await exec("git", ["-c", "user.name=Dojo", "-c", "user.email=dojo@example.invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "Initial commit"], { cwd: dir });
        }
        this.adopt = { key: "sandbox", from: spaces().map((x) => x.id) };
        run("space.new", { name: "Dojo repo", folder: dir });
      } catch {}
      cx.notify();
    });
  }

  ready(l, s) {
    if (l.needsPractice !== false) {
      const p = practiceOf(s);
      if (!p || !p.active) return false;
      if (p.tabs.length < (l.minTabs ?? 0) || p.tabs.reduce((n, t) => n + t.panes, 0) < (l.minPanes ?? 0)) return false;
    }
    if (s.spaces.length < (l.minSpaces ?? 0)) return false;
    if (l.needsDemo && !demoOf(s)) return false;
    if (l.needsSandbox && !(s.sandbox && s.spaces.some((x) => x.id === s.sandbox))) return false;
    if (l.needsWorktree && !worktrees(s).length) return false;
    return true;
  }

  // things that can only be launched once the space they live in exists
  launchLater(l, s) {
    if (l.needsDemo && practiceOf(s) && !demoOf(s) && !this.launched.demo) {
      this.launched.demo = true;
      run("tab.new", { space: s.practice, name: "Practice agent", argv: ["sh", `${appHome()}/mods/dojo/demo-agent.sh`] });
    }
    if (l.needsWorktree && s.sandbox && s.spaces.some((x) => x.id === s.sandbox) && !worktrees(s).length && !this.launched.wt) {
      this.launched.wt = true;
      openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: s.sandbox, action: "new", branch: "dojo-demo" } });
    }
  }

  tick(cx) {
    let changed = false;
    const needMods = (this.pending ? LESSONS[this.pending.idx] : this.cur ? LESSONS[this.cur.idx] : null)?.needsMods;
    if (needMods && Date.now() - this.modsAt > 1500) {
      this.modsAt = Date.now();
      exec("ls", [`${appHome()}/mods`]).then((r) => {
        const list = r.stdout.split("\n").map((x) => x.trim()).filter(Boolean);
        if (JSON.stringify(list) !== JSON.stringify(this.mods)) { this.mods = list; cx.notify(); }
      }).catch(() => {});
    }
    if (this.adopt) {
      const fresh = spaces().find((x) => !this.adopt.from.includes(x.id));
      if (fresh) {
        if (this.adopt.key === "sandbox") this.store.sandboxSpace = fresh.id; else this.store.practice = fresh.id;
        this.adopt = null; this.save(); changed = true;
      }
    }
    if (this.pending) {
      const l = LESSONS[this.pending.idx];
      const s = this.state();
      this.launchLater(l, s);
      const limit = l.needsSandbox ? 15000 : l.needsDemo || l.needsWorktree ? 8000 : 2500;
      if (this.ready(l, s) || Date.now() - this.pending.at > limit) {
        this.cur = { idx: this.pending.idx, start: s, step: 0, t0: Date.now(), ms: null };
        this.store.cur = { idx: this.cur.idx, start: s, step: 0, t0: this.cur.t0, helped: false };
        this.save();
        this.pending = null;
        changed = true;
      }
    } else if (this.cur && this.cur.ms === null) {
      const l = LESSONS[this.cur.idx];
      const now = this.state();
      let step = this.cur.step;
      while (step < l.steps.length && l.steps[step].test(this.cur.start, now)) step++;
      if (step !== this.cur.step) {
        this.cur.step = step;
        this.store.cur = { idx: this.cur.idx, start: this.cur.start, step, t0: this.cur.t0, helped: this.helped };
        this.save();
        changed = true;
      }
      if (step >= l.steps.length) { this.finish(l, now); changed = true; }
    }
    if (changed) cx.notify();
  }

  finish(l, now) {
    const c = this.cur;
    c.ms = Date.now() - c.t0;
    if (l.adopt) { const id = l.adopt(c.start, now); if (id) this.store.practice = id; }
    const prev = this.store.done[l.id];
    let medal = null;
    if (l.goal && !this.helped) medal = c.ms <= l.goal * 1000 ? "gold" : c.ms <= l.goal * 2000 ? "silver" : null;
    const rank = (m) => (m === "gold" ? 2 : m === "silver" ? 1 : 0);
    const keep = prev && rank(prev.medal) >= rank(medal) ? prev.medal ?? null : medal;
    this.store.done[l.id] = { ms: c.ms, best: prev ? Math.min(prev.best ?? prev.ms, c.ms) : c.ms, helped: prev ? prev.helped && this.helped : this.helped, medal: keep };
    this.store.cur = null;
    this.save();
  }

  // ---- extras ----
  trophies() {
    const done = LESSONS.filter((l) => this.store.done[l.id]);
    const unaided = done.filter((l) => !this.store.done[l.id].helped && !this.store.done[l.id].skipped).length;
    const golds = done.filter((l) => this.store.done[l.id].medal === "gold").length;
    const out = [];
    if (done.length >= 1) out.push("first");
    if (unaided >= 10) out.push("selftaught");
    if (golds >= 5) out.push("quick");
    CHAPTERS.forEach((c) => { if (c.lessons.every((l) => this.store.done[l.id])) out.push(`ch:${c.id}`); });
    if (done.length === LESSONS.length) out.push("master");
    return out;
  }
  trophyName(id) {
    const es = this.store.lang === "es";
    const names = { first: ["First steps", "Primeros pasos"], selftaught: ["Self-taught", "Autodidacta"], quick: ["Quick hands", "Manos rápidas"], master: ["Dojo master", "Maestro del Dojo"] };
    if (id.startsWith("ch:")) return `${es ? "Capítulo" : "Chapter"}: ${this.chapterTitle(id.slice(3))}`;
    return names[id][es ? 1 : 0];
  }

  cleanup(cx) {
    const s = this.state();
    const close = (id) => { if (id && s.spaces.some((x) => x.id === id)) run("space.close", { id, confirmed: true }); };
    const wts = worktrees(s).filter((x) => (x.folder ?? "").includes("/worktrees/scratch-repo"));
    cx.spawn(async (cx) => {
      for (const w of wts) {
        close(w.id);
        try { await exec("git", ["worktree", "remove", "--force", w.folder], { cwd: SCRATCH() }); } catch {}
      }
      close(s.practice);
      close(s.sandbox);
      try { await exec("rm", ["-rf", SCRATCH()]); await exec("rm", ["-rf", PRACTICE_MOD()]); } catch {}
      this.store.practice = null; this.store.sandboxSpace = null; this.save();
      cx.notify();
    });
  }

  // ---- UI ----
  keycaps(t, action) {
    const found = bindingsFor(action);
    if (!found.length) return div().text_size(11.5).text_color(t.dim).child(this.ui("noKey"));
    const one = (combo) => h_flex().gap(4).items_center().children(caps(combo).map((k, i) => div().id(`kc-${combo}-${i}`).px(7).h(22).flex().items_center().rounded(6).bg(t.raised)
      .border_1().border_color(t.border).text_size(11.5).font_medium().text_color(t.foreground).child(k)));
    return h_flex().gap(10).items_center().children(found.flatMap((combo, i) => (i ? [div().text_size(11).text_color(t.dim).child(this.ui("or")), one(combo)] : [one(combo)])));
  }

  button(t, id, label, primary, fn) {
    return h_flex().id(id).h(30).px(12).items_center().rounded(8).border_1()
      .border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium().cursor_pointer()
      .hover((s) => s.opacity(0.88)).on_click(fn).child(label);
  }

  card(t, l, idx) {
    const L = this.lt(l);
    const done = this.store.done[l.id];
    const unlocked = idx <= this.firstUndone();
    const active = this.cur?.idx === idx;
    const current = (this.cur?.idx ?? this.pending?.idx ?? this.openIdx) === idx;
    const settled = active && this.cur.ms !== null;
    const now = current ? this.state() : null;
    const reason = current && l.skip ? l.skip(now) : null;

    const medal = done?.skipped ? null : done?.medal;
    const mark = done?.skipped ? div().text_color(t.dim).child("–")
      : medal ? div().text_color(medal === "gold" ? GOLD : SILVER).child("●")
      : done ? div().text_color(t.ansi2).font_bold().child("✓")
      : div().text_color(unlocked ? t.accent : t.dim).child(String(idx + 1));
    const head = h_flex().id(`lh-${l.id}`).h(34).px(10).gap(10).items_center().rounded(9).cursor_pointer()
      .text_size(13).font_semibold().text_color(unlocked ? t.foreground : t.dim)
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { if (unlocked) { if (current && active) { this.openIdx = null; cx.notify(); } else this.start(idx, cx); } })
      .child(div().w(18).flex_none().flex().justify_center().text_size(12).child(mark))
      .child(div().flex_1().min_w(0).truncate().child(L.title))
      .when(Boolean(done), (el) => el.child(div().text_size(11).font_normal().text_color(t.dim).child(done.skipped ? this.ui("skipped") : fmtMs(done.best ?? done.ms))));
    if (!current) return v_flex().id(`lc-${l.id}`).flex_none().child(head);

    const steps = l.steps.map((st, i) => {
      const ok = active && this.cur.step > i;
      const nowStep = active && !settled && this.cur.step === i;
      return h_flex().id(`st-${l.id}-${i}`).gap(8).items_start().text_size(12.5)
        .child(div().w(14).flex_none().text_color(ok ? t.ansi2 : nowStep ? t.accent : t.dim).child(ok ? "✓" : "○")
          .when(nowStep, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1100 })))
        .child(div().flex_1().min_w(0).text_color(ok ? t.muted : t.foreground).child(L.steps[i]));
    });

    const shown = this.hints[l.id] ?? 0;
    const actions = [];
    if (settled) {
      actions.push(idx + 1 < LESSONS.length
        ? this.button(t, `next-${l.id}`, this.ui("next"), true, (_e, cx) => this.start(idx + 1, cx))
        : this.button(t, `again-${l.id}`, this.ui("replay"), false, (_e, cx) => this.start(idx, cx)));
    } else if (active) {
      const step = this.cur.step;
      if (l.doit && !reason) {
        const label = L.primary ?? this.ui("doit");
        actions.push(this.button(t, `doit-${l.id}`, label, Boolean(l.primary), (_e, cx) => {
          if (!l.primary) { this.helped = true; if (this.store.cur) { this.store.cur.helped = true; this.save(); } }
          l.doit(this.api(), this.state(), step, this.cur?.start);
          cx.notify();
        }));
      }
      if (L.hints.length && shown < L.hints.length) actions.push(this.button(t, `hint-${l.id}`, this.ui("hint"), false, (_e, cx) => {
        this.hints[l.id] = shown + 1; this.helped = true;
        if (this.store.cur) { this.store.cur.helped = true; this.save(); }
        cx.notify();
      }));
      if (L.manual && !reason) actions.push(this.button(t, `manual-${l.id}`, L.manual, true, (_e, cx) => { this.cur.step = l.steps.length; this.finish(l, this.state()); cx.notify(); }));
    } else if (!this.pending) {
      actions.push(this.button(t, `go-${l.id}`, this.ui("start"), true, (_e, cx) => this.start(idx, cx)));
    }
    if ((reason || l.skippable) && !settled) {
      actions.push(this.button(t, `skip-${l.id}`, this.ui("skip"), false, (_e, cx) => {
        this.store.done[l.id] = { ms: 0, best: 0, skipped: true, helped: true, medal: null };
        this.store.cur = null; this.save(); this.cur = null; this.pending = null;
        this.openIdx = Math.min(idx + 1, LESSONS.length - 1);
        cx.notify();
      }));
    }

    return v_flex().id(`lc-${l.id}`).flex_none().rounded(10).bg(t.surface ?? t.raised).border_1().border_color(settled ? t.ansi2 + "88" : t.border).mt(2).mb(4).pb(12)
      .child(head)
      .child(v_flex().px(12).gap(10)
        .child(div().text_size(12.5).text_color(t.muted).child(L.teach))
        .when(Boolean(l.want), (el) => el.child(v_flex().gap(5).child(div().text_size(10.5).font_semibold().text_color(t.dim).child(this.ui("yourShortcut"))).child(this.keycaps(t, l.want))))
        .child(v_flex().gap(5).child(div().text_size(10.5).font_semibold().text_color(t.dim).child(this.ui("yourTurn"))).children(steps))
        .when(shown > 0, (el) => el.child(v_flex().gap(4).child(div().text_size(10.5).font_semibold().text_color(t.ansi3).child(this.ui("hintLabel")))
          .children(L.hints.slice(0, shown).map((h, i) => div().id(`h-${l.id}-${i}`).text_size(12).text_color(t.muted).child(h)))))
        .when(Boolean(reason), (el) => el.child(div().text_size(12).text_color(t.ansi3).child(this.store.lang === "es" ? (ES.reasons[reason] ?? reason) : reason)))
        .when(this.pending?.idx === idx, (el) => el.child(div().text_size(11.5).text_color(t.dim).child(this.ui("settingUp"))))
        .when(settled, (el) => el.child(div().text_size(12.5).font_semibold().text_color(medal === "gold" ? GOLD : t.ansi2).child(this.ui("doneIn", { t: fmtMs(this.cur.ms) }))))
        .child(h_flex().gap(8).flex_wrap().children(actions)));
  }

  render() {
    const t = theme();
    const total = LESSONS.length;
    const doneN = LESSONS.filter((l) => this.store.done[l.id]).length;
    const first = this.firstUndone();
    const totalMs = LESSONS.reduce((n, l) => n + (this.store.done[l.id]?.best ?? 0), 0);
    const here = LESSONS[Math.min(first, total - 1)];
    if (this.openIdx === null && !this.cur && !this.pending) this.openIdx = Math.min(first, total - 1);
    if (this.openChapter === null) this.openChapter = LESSONS[this.openIdx ?? Math.min(first, total - 1)].chapter;
    const chNo = CHAPTERS.findIndex((c) => c.id === here.chapter) + 1;
    const earned = this.trophies();

    const header = v_flex().flex_none().px(16).pt(14).pb(8).gap(4)
      .child(h_flex().items_center().gap(8)
        .child(div().text_size(15).font_bold().text_color(t.foreground).child("Herdr Dojo"))
        .child(div().flex_1())
        .child(div().text_size(11.5).text_color(t.dim).child(`${doneN} / ${total}`))
        .child(div().id("dojo-lang").px(6).h(20).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(10.5).font_semibold().text_color(t.muted).cursor_pointer()
          .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.store.lang = this.store.lang === "es" ? "en" : "es"; this.save(); cx.notify(); })
          .child(this.store.lang === "es" ? "ES" : "EN"))
        .child(div().id("dojo-close").w(22).h(22).flex().items_center().justify_center().rounded(6).text_size(15).text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { const id = props()?.overlay; if (id != null) closeOverlay(id); else run("overlay.close", {}); })
          .child("×")))
      .child(div().text_size(11.5).text_color(t.dim).child(this.ui("chapterOf", { n: chNo, m: CHAPTERS.length, t: this.chapterTitle(here.chapter) })))
      .child(div().h(4).w_full().rounded(2).bg(t.raised).mt(4).child(div().h(4).rounded(2).bg(t.accent).w(`${Math.round((doneN / total) * 100)}%`)))
      .when(earned.length > 0, (el) => el.child(h_flex().gap(5).flex_wrap().mt(6).children(earned.map((id) => div().id(`tr-${id}`).px(7).h(18).flex().items_center().rounded(9).bg(t.raised).text_size(10).font_medium().text_color(GOLD).child(`★ ${this.trophyName(id)}`)))));

    const finished = doneN === total;
    const practiceReady = LESSONS.some((l) => this.store.done[l.id] && !l.manual && !l.skip && !l.skippable);
    const footer = v_flex().flex_none().px(16).py(10).gap(8).border_t(1).border_color(t.border)
      .when(finished, (el) => el.child(div().text_size(12.5).font_semibold().text_color(t.ansi2).child(this.ui("allDone", { t: fmtMs(totalMs) }))))
      .child(h_flex().gap(8).flex_wrap()
        .when(practiceReady, (el) => el.child(this.button(t, "practice", this.ui("practice"), false, (_e, cx) => {
          const pool = LESSONS.map((l, i) => i).filter((i) => this.store.done[LESSONS[i].id] && !LESSONS[i].manual && !LESSONS[i].skip && !LESSONS[i].skippable && !this.store.done[LESSONS[i].id].skipped);
          if (pool.length) this.start(pool[Math.floor(Math.random() * pool.length)], cx);
        })))
        .child(this.confirm === "cleanup"
          ? this.button(t, "cleanup-yes", this.ui("reallyCleanup"), true, (_e, cx) => { this.cleanup(cx); this.confirm = null; this.cur = null; this.pending = null; this.store.cur = null; cx.notify(); })
          : this.button(t, "cleanup", this.ui("cleanup"), false, (_e, cx) => { this.confirm = "cleanup"; cx.notify(); }))
        .child(this.confirm === "reset"
          ? this.button(t, "reset-yes", this.ui("reallyReset"), true, (_e, cx) => { this.store = { ...this.store, done: {}, cur: null }; this.save(); this.cur = null; this.pending = null; this.openIdx = 0; this.openChapter = null; this.confirm = null; cx.notify(); })
          : this.button(t, "reset", this.ui("reset"), false, (_e, cx) => { this.confirm = "reset"; cx.notify(); })))
      .when(this.confirm === "cleanup", (el) => el.child(div().text_size(11).text_color(t.dim).child(this.ui("cleanupNote"))));

    const list = CHAPTERS.flatMap((c, ci) => {
      const lessons = LESSONS.map((l, i) => [l, i]).filter(([l]) => l.chapter === c.id);
      const open = this.openChapter === c.id;
      const n = lessons.filter(([l]) => this.store.done[l.id]).length;
      const head = h_flex().id(`ch-${c.id}`).flex_none().px(10).pt(ci === 0 ? 2 : 12).pb(4).gap(6).items_center().cursor_pointer()
        .text_size(10.5).font_semibold().text_color(open ? t.foreground : t.dim)
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => { this.openChapter = open ? "" : c.id; cx.notify(); })
        .child(div().child(open ? "▾" : "▸"))
        .child(div().flex_1().min_w(0).truncate().child(this.ui("chapterHead", { n: ci + 1, t: this.chapterTitle(c.id).toUpperCase() })))
        .child(div().font_normal().text_color(t.dim).child(`${n}/${lessons.length}`));
      return [head, ...(open ? lessons.map(([l, i]) => this.card(t, l, i)) : [])];
    });

    return v_flex().size_full().min_h(0).bg(t.popover ?? t.chrome).text_color(t.foreground)
      .child(header)
      .child(v_flex().id("dojo-list").flex_1().min_h(0).px(10).overflow_y_scrollbar().children(list))
      .child(footer);
  }
}
