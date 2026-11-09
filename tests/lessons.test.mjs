// Run with: node tests/lessons.test.mjs   (Node 18+, no dependencies)
import { CHAPTERS, practiceOf, demoOf, worktrees } from "../mods/dojo/lessons.js";
import { ES } from "../mods/dojo/es.js";

const ALL = CHAPTERS.flatMap((c) => c.lessons);
const L = Object.fromEntries(ALL.map((l) => [l.id, l]));
let fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
  else console.log("ok  ", name);
};

// ---- state builders ----
const tab = (id, o = {}) => ({ id, active: false, panes: 1, zoomed: false, named: false, settled: false, ...o });
const sp = (id, tabs, o = {}) => ({ id, name: id, named: false, active: false, index: 1, folder: "", machine: null, tabs, ...o });
const st = (spaces, o = {}) => ({
  spaces, panes: [], focused: { pane: "p1", agent: null }, agents: 0, agentList: [], practice: "pr", sandbox: null,
  look: "A", themeSig: "T", keysSig: "K", machines: [], mods: [], ...o,
});
const run = (id, i, a, b) => L[id].steps[i].test(a, b);

// ---- curriculum shape ----
check("every lesson has id, title, teach, steps", ALL.every((l) => l.id && l.title && l.teach && l.steps?.length), true);
check("lesson ids are unique", new Set(ALL.map((l) => l.id)).size, ALL.length);
check("every step has text and test", ALL.every((l) => l.steps.every((s) => s.text && typeof s.test === "function")), true);
check("every non-manual lesson can be done", ALL.filter((l) => !l.manual).every((l) => l.steps.some((s) => s.test.length >= 0)), true);
check("manual lessons have a doit or a label", ALL.filter((l) => l.manual).every((l) => typeof l.manual === "string"), true);

// ---- Spanish stays in sync ----
check("every lesson is translated", ALL.filter((l) => !ES.lessons[l.id]).map((l) => l.id), []);
check("no translation without a lesson", Object.keys(ES.lessons).filter((id) => !L[id]), []);
check("translated step counts match", ALL.filter((l) => ES.lessons[l.id]?.steps?.length !== l.steps.length).map((l) => l.id), []);
check("translated manual/primary labels exist", ALL.filter((l) => (l.manual && !ES.lessons[l.id]?.manual) || (l.primary && !ES.lessons[l.id]?.primary)).map((l) => l.id), []);
check("every chapter is translated", CHAPTERS.filter((c) => !ES.chapters[c.id]).map((c) => c.id), []);
check("skip reasons are translated", ALL.filter((l) => l.skip).flatMap((l) => [l.skip(st([], { agents: 0, machines: [] }))]).filter((r) => r && !ES.reasons[r]), []);

// ---- chapter 1 ----
const a1 = st([sp("x", [tab("t")])], { practice: null });
const b1 = st([sp("x", [tab("t")]), sp("pr", [tab("t2")])], { practice: null });
check("new-space no", run("new-space", 0, a1, a1), false);
check("new-space yes", run("new-space", 0, a1, b1), true);
check("new-space adopts the new id", L["new-space"].adopt(a1, b1), "pr");

const a2 = st([sp("pr", [tab("t")])]);
check("rename no", run("rename-space", 0, a2, a2), false);
check("rename yes", run("rename-space", 0, a2, st([sp("pr", [tab("t")], { named: true, name: "Work" })])), true);
check("rename to same name no", run("rename-space", 0, a2, st([sp("pr", [tab("t")], { named: true, name: "pr" })])), false);

check("new-tab yes", run("new-tab", 0, a2, st([sp("pr", [tab("t"), tab("u")])])), true);
check("new-tab no", run("new-tab", 0, a2, a2), false);

const a4 = st([sp("pr", [tab("t", { active: true }), tab("u")])]);
check("switch-tab no", run("switch-tab", 0, a4, a4), false);
check("switch-tab yes", run("switch-tab", 0, a4, st([sp("pr", [tab("t"), tab("u", { active: true })])])), true);

const one = st([sp("pr", [tab("t", { panes: 1 })])]);
const two = st([sp("pr", [tab("t", { panes: 2 })])]);
check("split-right yes", run("split-right", 0, one, two), true);
check("split-right no", run("split-right", 0, one, one), false);
check("split-down yes", run("split-down", 0, one, two), true);
check("close-pane yes", run("close-pane", 0, two, one), true);
check("close-pane no", run("close-pane", 0, two, two), false);

check("move-focus no", run("move-focus", 0, st([], { focused: { pane: "p1" } }), st([], { focused: { pane: "p1" } })), false);
check("move-focus yes", run("move-focus", 0, st([], { focused: { pane: "p1" } }), st([], { focused: { pane: "p2" } })), true);

const z1 = st([sp("pr", [tab("t", { panes: 2, zoomed: true })])]);
check("zoom step 1 no", run("zoom", 0, two, two), false);
check("zoom step 1 yes", run("zoom", 0, two, z1), true);
check("zoom step 2 while zoomed", run("zoom", 1, two, z1), false);
check("zoom step 2 after", run("zoom", 1, two, two), true);

const s0 = st([sp("pr", [tab("t")], { active: true }), sp("o", [tab("t")])]);
const s1 = st([sp("pr", [tab("t")]), sp("o", [tab("t")], { active: true })]);
check("switch-space 1 no", run("switch-space", 0, s0, s0), false);
check("switch-space 1 yes", run("switch-space", 0, s0, s1), true);
check("switch-space 2 away", run("switch-space", 1, s0, s1), false);
check("switch-space 2 back", run("switch-space", 1, s0, s0), true);

// ---- chapter 2 ----
const r1 = st([sp("pr", [tab("t", { active: true, named: true }), tab("u")])]);
const r0 = st([sp("pr", [tab("t", { active: true }), tab("u")])]);
check("rename-tab no", run("rename-tab", 0, r0, r0), false);
check("rename-tab yes", run("rename-tab", 0, r0, r1), true);
check("rename-tab already named", run("rename-tab", 0, r1, r1), false);

// ---- chapter 3: agents ----
const ag = (status, o = {}) => ({ address: "t9", app: "dojo-agent", status, pinned: false, ...o });
const none = st([sp("pr", [tab("t")])]);
const idle = st([sp("pr", [tab("t")])], { agentList: [ag("idle")], agents: 1 });
const working = st([sp("pr", [tab("t")])], { agentList: [ag("working")], agents: 1 });
const blocked = st([sp("pr", [tab("t")])], { agentList: [ag("blocked")], agents: 1 });
const done = st([sp("pr", [tab("t")])], { agentList: [ag("done")], agents: 1 });
const pinned = st([sp("pr", [tab("t")])], { agentList: [ag("idle", { pinned: true })], agents: 1 });
check("demoOf finds the practice agent only", demoOf(st([], { agentList: [{ app: "claude-code", status: "idle" }] })), null);
check("start-agent no", run("start-agent", 0, none, none), false);
check("start-agent yes", run("start-agent", 0, none, idle), true);
check("agent-working no", run("agent-working", 0, idle, idle), false);
check("agent-working yes", run("agent-working", 0, idle, working), true);
check("agent-blocked no", run("agent-blocked", 0, working, working), false);
check("agent-blocked yes", run("agent-blocked", 0, working, blocked), true);
check("agent-answer step 1 while blocked", run("agent-answer", 0, blocked, blocked), false);
check("agent-answer step 1 working", run("agent-answer", 0, blocked, working), true);
check("agent-answer step 2 working", run("agent-answer", 1, blocked, working), false);
check("agent-answer step 2 done", run("agent-answer", 1, blocked, done), true);
check("agent-answer step 2 idle", run("agent-answer", 1, blocked, idle), true);
check("agent-pin no", run("agent-pin", 0, idle, idle), false);
check("agent-pin yes", run("agent-pin", 0, idle, pinned), true);
check("agent-stop no", run("agent-stop", 0, idle, idle), false);
check("agent-stop yes", run("agent-stop", 0, idle, none), true);
check("cycle-agents no", run("cycle-agents", 0, st([], { focused: { agent: "t1" } }), st([], { focused: { agent: "t1" } })), false);
check("cycle-agents yes", run("cycle-agents", 0, st([], { focused: { agent: "t1" } }), st([], { focused: { agent: "t2" } })), true);
check("cycle-agents to nothing", run("cycle-agents", 0, st([], { focused: { agent: "t1" } }), st([], { focused: { agent: null } })), false);
check("cycle-agents skip with one agent", typeof L["cycle-agents"].skip(st([], { agents: 1 })), "string");
check("cycle-agents no skip with two", L["cycle-agents"].skip(st([], { agents: 2 })), null);

// ---- chapter 4: worktrees ----
const repo = sp("rp", [tab("t")], { folder: "/x/scratch-repo" });
const wt = sp("wt", [tab("t")], { folder: "/home/u/.herdr/worktrees/scratch-repo/dojo-demo" });
check("worktrees() finds only worktree folders", worktrees(st([repo, wt])).map((x) => x.id), ["wt"]);
check("wt-sandbox no", run("wt-sandbox", 0, st([], { sandbox: "rp" }), st([], { sandbox: "rp" })), false);
check("wt-sandbox yes", run("wt-sandbox", 0, st([], { sandbox: "rp" }), st([repo], { sandbox: "rp" })), true);
check("wt-new no", run("wt-new", 0, st([repo]), st([repo])), false);
check("wt-new yes", run("wt-new", 0, st([repo]), st([repo, wt])), true);
check("wt-remove no", run("wt-remove", 0, st([repo, wt]), st([repo, wt])), false);
check("wt-remove yes", run("wt-remove", 0, st([repo, wt]), st([repo])), true);

// ---- chapter 5: customize ----
check("theme 1 no", run("theme", 0, st([], { themeSig: "A" }), st([], { themeSig: "A" })), false);
check("theme 1 yes", run("theme", 0, st([], { themeSig: "A" }), st([], { themeSig: "B" })), true);
check("theme 2 still changed", run("theme", 1, st([], { themeSig: "A" }), st([], { themeSig: "B" })), false);
check("theme 2 back", run("theme", 1, st([], { themeSig: "A" }), st([], { themeSig: "A" })), true);
check("zoom-app 1 yes", run("zoom-app", 0, st([], { look: "1" }), st([], { look: "2" })), true);
check("zoom-app 1 not when the theme changed", run("zoom-app", 0, st([], { look: "1", themeSig: "A" }), st([], { look: "2", themeSig: "B" })), false);
check("zoom-app 2 back", run("zoom-app", 1, st([], { look: "1" }), st([], { look: "1" })), true);
check("zoom-app 2 still zoomed", run("zoom-app", 1, st([], { look: "1" }), st([], { look: "2" })), false);
check("bind-key no", run("bind-key", 0, st([], { keysSig: "K" }), st([], { keysSig: "K" })), false);
check("bind-key yes", run("bind-key", 0, st([], { keysSig: "K" }), st([], { keysSig: "K2" })), true);

// ---- chapter 6: organize ----
const panesOf = (ids) => ids.map((p) => ({ pane: p, tab: "t" }));
const p0 = st([sp("pr", [tab("t", { panes: 2 })])], { panes: panesOf(["a", "b"]) });
const p1 = st([sp("pr", [tab("t", { panes: 2 })])], { panes: panesOf(["b", "a"]) });
check("swap no", run("swap", 0, p0, p0), false);
check("swap yes", run("swap", 0, p0, p1), true);
const t0 = st([sp("pr", [tab("a"), tab("b")])]);
const t1 = st([sp("pr", [tab("b"), tab("a")])]);
check("move-tab no", run("move-tab", 0, t0, t0), false);
check("move-tab yes", run("move-tab", 0, t0, t1), true);
const settled = st([sp("pr", [tab("a"), tab("b", { settled: true })])]);
check("settle 1 no", run("settle", 0, t0, t0), false);
check("settle 1 yes", run("settle", 0, t0, settled), true);
check("settle 2 while settled", run("settle", 1, t0, settled), false);
check("settle 2 back", run("settle", 1, t0, t0), true);
check("move-space no", run("move-space", 0, st([sp("pr", [], { index: 1 })]), st([sp("pr", [], { index: 1 })])), false);
check("move-space yes", run("move-space", 0, st([sp("pr", [], { index: 1 })]), st([sp("pr", [], { index: 2 })])), true);

// ---- chapter 7: machines ----
check("machine-add no", run("machine-add", 0, st([], { machines: [] }), st([], { machines: [] })), false);
check("machine-add yes", run("machine-add", 0, st([], { machines: [] }), st([], { machines: ["box"] })), true);
const far = sp("fr", [tab("t")], { machine: "box" });
check("machine-space no", run("machine-space", 0, st([sp("x", [])]), st([sp("x", [])])), false);
check("machine-space yes", run("machine-space", 0, st([sp("x", [])]), st([sp("x", []), far])), true);
check("machine-space skipped with no machine", typeof L["machine-space"].skip(st([], { machines: [] })), "string");
check("machine-space not skipped with one", L["machine-space"].skip(st([], { machines: ["box"] })), null);

// ---- chapter 8: mods ----
check("mod-clone no", run("mod-clone", 0, st([], { mods: ["dojo"] }), st([], { mods: ["dojo"] })), false);
check("mod-clone yes", run("mod-clone", 0, st([], { mods: ["dojo"] }), st([], { mods: ["dojo", "dojo-practice"] })), true);
check("mod-remove no", run("mod-remove", 0, st([], { mods: ["dojo-practice"] }), st([], { mods: ["dojo-practice"] })), false);
check("mod-remove yes", run("mod-remove", 0, st([], { mods: ["dojo-practice"] }), st([], { mods: ["dojo"] })), true);

check("practiceOf missing", practiceOf(st([sp("x", [])])), null);

// ---- doit never throws on an empty state ----
const api = { run: () => {}, openOverlay: () => {}, exec: () => {}, appHome: () => "/h" };
let threw = [];
for (const l of ALL) { if (l.doit) for (let step = 0; step < l.steps.length; step++) { try { l.doit(api, st([sp("pr", [tab("t")])]), step, st([])); } catch (e) { threw.push(`${l.id}:${step}`); } } }
check("doit survives a thin state", threw, []);

console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
