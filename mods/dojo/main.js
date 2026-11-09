// Herdr Dojo: learn Herdr by doing it. A floating window with short lessons; each one asks for a real action
// (make a space, split a pane...) and notices when you've done it by reading Herdr's live state, so it works
// with whatever shortcuts you have bound. Shortcuts shown are read from your own keys.json.
//
// Open it with `mod.open:dojo` (bind a key, or find "mod.open" in the command palette).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, agents, keys, theme, run, props, closeOverlay } from "herdr";
import { CHAPTERS, practiceOf } from "./lessons.js";

const STORE = "dojo.v1";
const LESSONS = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.id, chapterTitle: c.title })));

const readStore = () => {
  try { return { done: {}, practice: null, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") }; } catch { return { done: {}, practice: null }; }
};
const writeStore = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch {} };

const snap = (practice) => ({ spaces: spaces(), panes: panes(), focused: focused(), agents: agents().length, practice });

// "cmd-shift-]" -> ["Cmd", "Shift", "]"]. Modifiers come first; the rest is the key (which may itself be "-" or "+").
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
// Bindings for an action, the most general section first.
const bindingsFor = (action) => {
  const rank = (s) => (s === "global" ? 0 : s.startsWith("layout:") ? 1 : 2);
  return keys().filter((k) => k.action === action).sort((a, b) => rank(a.section) - rank(b.section)).slice(0, 2).map((k) => k.keys);
};

const fmtMs = (ms) => (ms < 10000 ? `${(ms / 1000).toFixed(1)}s` : ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

export default class Dojo extends View {
  init(_props, cx) {
    this.store = readStore();
    this.cur = null; // the lesson in progress: { idx, start, step, t0, ms }
    this.pending = null; // a lesson being set up: { idx, at }
    this.confirm = null; // "cleanup" | "reset" after a first click
    this.openIdx = null;
    cx.timer.every(400, (cx) => this.tick(cx));
  }

  save() { writeStore(this.store); }
  firstUndone() { const i = LESSONS.findIndex((l) => !this.store.done[l.id]); return i === -1 ? LESSONS.length : i; }

  // Set a lesson up (the practice space, enough tabs or panes) and begin it once the state matches.
  start(idx, cx) {
    const l = LESSONS[idx];
    this.confirm = null;
    this.openIdx = idx;
    const s = snap(this.store.practice);
    const p = practiceOf(s);
    this.adoptFrom = null;
    if (l.needsPractice !== false) {
      if (!p) { this.adoptFrom = s.spaces.map((x) => x.id); run("space.new", { name: "Dojo practice" }); }
      else {
        if (!p.active) run("space.select", { id: p.id });
        const tabs = p.tabs.length;
        for (let i = tabs; i < (l.minTabs ?? 0); i++) run("tab.new", { space: p.id });
        const have = p.tabs.reduce((n, t) => n + t.panes, 0);
        for (let i = have; i < (l.minPanes ?? 0); i++) run("pane.split", { direction: "right" });
      }
    }
    if ((l.minSpaces ?? 0) > s.spaces.length) run("space.new", {});
    this.pending = { idx, at: Date.now() };
    this.cur = null;
    cx.notify();
  }

  ready(l, s) {
    if (l.needsPractice === false) return true;
    const p = practiceOf(s);
    if (!p) return false;
    return p.active && p.tabs.length >= (l.minTabs ?? 0) && p.tabs.reduce((n, t) => n + t.panes, 0) >= (l.minPanes ?? 0) && s.spaces.length >= (l.minSpaces ?? 0);
  }

  tick(cx) {
    let changed = false;
    if (this.adoptFrom) {
      const fresh = spaces().find((x) => !this.adoptFrom.includes(x.id));
      if (fresh) { this.store.practice = fresh.id; this.adoptFrom = null; this.save(); changed = true; }
    }
    if (this.pending) {
      const l = LESSONS[this.pending.idx];
      const s = snap(this.store.practice);
      if (this.ready(l, s) || Date.now() - this.pending.at > 2500) {
        this.cur = { idx: this.pending.idx, start: s, step: 0, t0: Date.now(), ms: null };
        this.pending = null;
        changed = true;
      }
    } else if (this.cur && this.cur.ms === null) {
      const l = LESSONS[this.cur.idx];
      const now = snap(this.store.practice);
      let step = this.cur.step;
      while (step < l.steps.length && l.steps[step].test(this.cur.start, now)) step++;
      if (step !== this.cur.step) { this.cur.step = step; changed = true; }
      if (step >= l.steps.length) this.finish(l, now);
    }
    if (changed) cx.notify();
  }

  finish(l, now) {
    const c = this.cur;
    c.ms = Date.now() - c.t0;
    if (l.adopt) { const id = l.adopt(c.start, now); if (id) this.store.practice = id; }
    const prev = this.store.done[l.id];
    this.store.done[l.id] = { ms: c.ms, best: prev ? Math.min(prev.best ?? prev.ms, c.ms) : c.ms };
    this.save();
  }

  // ---- UI ----
  keycaps(t, action) {
    const found = bindingsFor(action);
    if (!found.length) {
      return div().text_size(11.5).text_color(t.dim).child("No key is bound to this. Use the command palette, or bind one in keys.json.");
    }
    const one = (combo) => h_flex().gap(4).items_center().children(caps(combo).map((k, i) => div().id(`kc-${combo}-${i}`).px(7).h(22).flex().items_center().rounded(6).bg(t.raised)
      .border_1().border_color(t.border).text_size(11.5).font_medium().text_color(t.foreground).child(k)));
    return h_flex().gap(10).items_center().children(found.flatMap((combo, i) => (i ? [div().text_size(11).text_color(t.dim).child("or"), one(combo)] : [one(combo)])));
  }

  button(t, id, label, primary, fn) {
    return h_flex().id(id).h(30).px(12).items_center().rounded(8).border_1()
      .border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium().cursor_pointer()
      .hover((s) => s.opacity(0.88)).on_click(fn).child(label);
  }

  card(t, l, idx, cx) {
    const done = this.store.done[l.id];
    const unlocked = idx <= this.firstUndone();
    const current = (this.cur?.idx ?? this.pending?.idx ?? this.openIdx) === idx;
    const active = this.cur?.idx === idx;
    const settled = active && this.cur.ms !== null;
    const mark = done ? div().text_color(t.ansi2).font_bold().child("✓") : div().text_color(unlocked ? t.accent : t.dim).child(String(idx + 1));
    const head = h_flex().id(`lh-${l.id}`).h(34).px(10).gap(10).items_center().rounded(9).cursor_pointer()
      .text_size(13).font_semibold().text_color(unlocked ? t.foreground : t.dim)
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { if (unlocked) { if (current && active) { this.openIdx = null; cx.notify(); } else this.start(idx, cx); } })
      .child(div().w(18).flex_none().flex().justify_center().text_size(12).child(mark))
      .child(div().flex_1().min_w(0).truncate().child(l.title))
      .when(Boolean(done), (el) => el.child(div().text_size(11).font_normal().text_color(t.dim).child(done.skipped ? "skipped" : fmtMs(done.best ?? done.ms))));
    if (!current) return v_flex().id(`lc-${l.id}`).flex_none().child(head);

    const steps = l.steps.map((st, i) => {
      const ok = active && this.cur.step > i;
      const now = active && !settled && this.cur.step === i;
      return h_flex().id(`st-${l.id}-${i}`).gap(8).items_start().text_size(12.5)
        .child(div().w(14).flex_none().text_color(ok ? t.ansi2 : now ? t.accent : t.dim).child(ok ? "✓" : "○")
          .when(now, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1100 })))
        .child(div().flex_1().min_w(0).text_color(ok ? t.muted : t.foreground).child(st.text));
    });
    const actions = [];
    if (settled) {
      const next = idx + 1;
      actions.push(next < LESSONS.length
        ? this.button(t, `next-${l.id}`, "Next lesson →", true, (_e, cx) => this.start(next, cx))
        : this.button(t, `again-${l.id}`, "Replay", false, (_e, cx) => this.start(idx, cx)));
    } else if (active) {
      actions.push(this.button(t, `doit-${l.id}`, "Do it for me", false, () => l.doit(run, snap(this.store.practice))));
      if (l.manual) actions.push(this.button(t, `manual-${l.id}`, l.manual, true, (_e, cx) => { this.cur.step = l.steps.length; this.finish(l, snap(this.store.practice)); cx.notify(); }));
    } else {
      actions.push(this.button(t, `go-${l.id}`, "Start", true, (_e, cx) => this.start(idx, cx)));
    }
    const short = l.minAgents && agents().length < l.minAgents;
    if (short && !settled) actions.push(this.button(t, `skip-${l.id}`, "Skip", false, (_e, cx) => { this.store.done[l.id] = { ms: 0, best: 0, skipped: true }; this.save(); this.cur = null; this.pending = null; this.openIdx = Math.min(idx + 1, LESSONS.length - 1); cx.notify(); }));
    return v_flex().id(`lc-${l.id}`).flex_none().rounded(10).bg(t.surface ?? t.raised).border_1().border_color(settled ? t.ansi2 + "88" : t.border).mt(2).mb(4).pb(12)
      .child(head)
      .child(v_flex().px(12).gap(10)
        .child(div().text_size(12.5).text_color(t.muted).child(l.teach))
        .when(Boolean(l.want), (el) => el.child(v_flex().gap(5).child(div().text_size(10.5).font_semibold().text_color(t.dim).child("YOUR SHORTCUT")).child(this.keycaps(t, l.want))))
        .child(v_flex().gap(5).child(div().text_size(10.5).font_semibold().text_color(t.dim).child("YOUR TURN")).children(steps))
        .when(Boolean(short), (el) => el.child(div().text_size(12).text_color(t.ansi3).child(`This one needs ${l.minAgents} running agents; you have ${agents().length}. You can skip it.`)))
        .when(this.pending?.idx === idx, (el) => el.child(div().text_size(11.5).text_color(t.dim).child("Setting up the practice space…")))
        .when(settled, (el) => el.child(div().text_size(12.5).font_semibold().text_color(t.ansi2).child(`Done in ${fmtMs(this.cur.ms)}`)))
        .child(h_flex().gap(8).children(actions)));
  }

  render() {
    const t = theme();
    const total = LESSONS.length;
    const doneN = LESSONS.filter((l) => this.store.done[l.id]).length;
    const first = this.firstUndone();
    const totalMs = LESSONS.reduce((n, l) => n + (this.store.done[l.id]?.best ?? 0), 0);
    const chapterNow = LESSONS[Math.min(first, total - 1)].chapterTitle;
    const chapterNo = CHAPTERS.findIndex((c) => c.title === chapterNow) + 1;
    const practice = practiceOf(snap(this.store.practice));
    if (this.openIdx === null && !this.cur && !this.pending) this.openIdx = Math.min(first, total - 1);

    const header = v_flex().flex_none().px(16).pt(14).pb(10).gap(4)
      .child(h_flex().items_center().gap(8)
        .child(div().text_size(15).font_bold().text_color(t.foreground).child("Herdr Dojo"))
        .child(div().flex_1())
        .child(div().text_size(11.5).text_color(t.dim).child(`${doneN} / ${total}`))
        .child(div().id("dojo-close").w(22).h(22).flex().items_center().justify_center().rounded(6).text_size(15).text_color(t.dim).cursor_pointer()
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => { const id = props()?.overlay; if (id != null) closeOverlay(id); else run("overlay.close", {}); })
          .child("×")))
      .child(div().text_size(11.5).text_color(t.dim).child(`Chapter ${chapterNo} of ${CHAPTERS.length} · ${chapterNow}`))
      .child(div().h(4).w_full().rounded(2).bg(t.raised).mt(4).child(div().h(4).rounded(2).bg(t.accent).w(`${Math.round((doneN / total) * 100)}%`)));

    const finished = doneN === total;
    const footer = v_flex().flex_none().px(16).py(10).gap(8).border_t(1).border_color(t.border)
      .when(finished, (el) => el.child(div().text_size(12.5).font_semibold().text_color(t.ansi2).child(`All chapters complete · ${fmtMs(totalMs)} in total`)))
      .child(h_flex().gap(8)
        .when(Boolean(practice), (el) => el.child(this.confirm === "cleanup"
          ? this.button(t, "cleanup-yes", "Really close it?", true, (_e, cx) => { run("space.close", { id: practice.id, confirmed: true }); this.store.practice = null; this.save(); this.confirm = null; cx.notify(); })
          : this.button(t, "cleanup", "Close practice space", false, (_e, cx) => { this.confirm = "cleanup"; cx.notify(); })))
        .child(this.confirm === "reset"
          ? this.button(t, "reset-yes", "Really reset?", true, (_e, cx) => { this.store = { done: {}, practice: this.store.practice }; this.save(); this.cur = null; this.pending = null; this.openIdx = 0; this.confirm = null; cx.notify(); })
          : this.button(t, "reset", "Reset progress", false, (_e, cx) => { this.confirm = "reset"; cx.notify(); })));

    return v_flex().size_full().min_h(0).bg(t.popover ?? t.chrome).text_color(t.foreground)
      .child(header)
      .child(v_flex().id("dojo-list").flex_1().min_h(0).px(10).overflow_y_scrollbar().children(LESSONS.flatMap((l, i) => [
        ...(i === 0 || LESSONS[i - 1].chapter !== l.chapter
          ? [div().id(`ch-${l.chapter}`).flex_none().px(10).pt(i === 0 ? 2 : 14).pb(4).text_size(10.5).font_semibold().text_color(t.dim).child(`CHAPTER ${CHAPTERS.findIndex((c) => c.id === l.chapter) + 1} · ${l.chapterTitle.toUpperCase()}`)]
          : []),
        this.card(t, l, i),
      ])))
      .child(footer);
  }
}
