// Herdr Dojo — the curriculum, as data.
//
// A lesson is a few `steps`. Each step has `test(start, now)`: it reads the live state of Herdr and says whether
// the person did what was asked, so nothing here listens to keystrokes and it works with whatever keys they bound.
// `start` is a snapshot taken when the lesson began; `now` is the current one.
//
// state = {
//   spaces: SpaceInfo[], panes: {pane, tab}[], focused,
//   agents: number, agentList: {address, app, status, pinned}[],
//   practice: id of the practice space | null,  sandbox: id of the scratch-repo space | null,
//   look: JSON of settings(), themeSig: string, keysSig: string,
//   machines: string[] (named machines), mods: string[] (folders in mods/),
// }
//
// Lesson fields (all optional but id/title/teach/steps):
//   want        command whose shortcut is shown (looked up in the person's own keys.json)
//   goal        seconds for a gold medal (no help used); twice that is silver
//   hints       progressively more explicit tips
//   doit(api, state, step, start)   performs the action for them ("Do it for me"); api = { run, openOverlay, exec, appHome }
//   primary     label that turns the doit button into the main action (for lessons with no shortcut)
//   manual      label of a button that finishes a lesson that cannot be detected
//   needsPractice:false, minTabs, minPanes, minSpaces, needsDemo, needsSandbox, needsWorktree, needsMods:
//               what the app prepares before the lesson starts
//   skip(state) returns a reason (string) when the lesson can't be done on this setup; shows a Skip button

export const DEMO_APP = "dojo-agent";

export const practiceOf = (s) => s.spaces.find((x) => x.id === s.practice) ?? null;
const tabsOf = (s) => practiceOf(s)?.tabs ?? [];
const paneTotal = (s) => tabsOf(s).reduce((n, t) => n + t.panes, 0);
const activeTab = (s) => tabsOf(s).find((t) => t.active) ?? null;
const paneOrder = (s) => {
  const ids = new Set(tabsOf(s).map((t) => t.id));
  return (s.panes ?? []).filter((p) => ids.has(p.tab)).map((p) => p.pane).join(",");
};
const tabOrder = (s) => tabsOf(s).map((t) => t.id).join(",");
export const demoOf = (s) => (s.agentList ?? []).find((a) => a.app === DEMO_APP) ?? null;
export const worktrees = (s) => s.spaces.filter((x) => (x.folder ?? "").includes("/worktrees/"));
const sandboxUp = (s) => !!s.sandbox && s.spaces.some((x) => x.id === s.sandbox);
const remote = (s) => s.spaces.filter((x) => x.machine);
// the theme name inside the settings snapshot; anything unreadable is "unknown"
const themeOf = (s) => { try { return JSON.parse(s?.look || "{}").theme ?? null; } catch { return null; } };

export const CHAPTERS = [
  {
    id: "basics",
    title: "Spaces, tabs & splits",
    lessons: [
      {
        id: "new-space", title: "Make a space", goal: 8, want: "space.new", needsPractice: false,
        teach: "A space is a place to work: usually one project. Each space has its own tabs and terminals. You'll practice in a space of your own, so nothing real gets touched.",
        hints: ["Press the shortcut shown below.", "Or click the + at the top of the Spaces list."],
        steps: [{ text: "Create a new space", test: (a, b) => b.spaces.length > a.spaces.length }],
        adopt: (a, b) => b.spaces.find((x) => !a.spaces.some((y) => y.id === x.id))?.id ?? null,
        doit: (api) => api.run("space.new", { name: "Dojo practice" }),
      },
      {
        id: "rename-space", title: "Name it", goal: 10, want: "space.rename",
        teach: "A space nobody named is called after its folder. Give it a name that says what you're doing there.",
        hints: ["Use the shortcut, type a name and press Enter.", "Right-click the space in the sidebar to find Rename."],
        steps: [{ text: "Rename the practice space", test: (a, b) => { const p = practiceOf(b); return !!p && p.named && p.name !== practiceOf(a)?.name; } }],
        doit: (api, s) => api.run("space.rename", { id: s.practice, name: "Practice" }),
      },
      {
        id: "new-tab", title: "Open a tab", goal: 6, want: "tab.new",
        teach: "A tab is one piece of work inside a space: a bug fix, a review, a long-running server. Open one more.",
        hints: ["Use the shortcut shown below.", "Or click the + in the tab bar."],
        steps: [{ text: "Open a new tab in the practice space", test: (a, b) => tabsOf(b).length > tabsOf(a).length }],
        doit: (api, s) => api.run("tab.new", { space: s.practice }),
      },
      {
        id: "switch-tab", title: "Hop between tabs", goal: 6, want: "tab.next", minTabs: 2,
        teach: "Move between the tabs of a space without touching the mouse. The next-tab key cycles; the number keys jump straight to one.",
        hints: ["Try the shortcut below, or Cmd/Ctrl plus a number."],
        steps: [{ text: "Go to another tab", test: (a, b) => { const x = activeTab(a), y = activeTab(b); return !!x && !!y && x.id !== y.id; } }],
        doit: (api) => api.run("tab.next", {}),
      },
      {
        id: "split-right", title: "Split to the right", goal: 6, want: "pane.split:right",
        teach: "A tab can hold several terminals side by side. Split the one you're in to put a second beside it.",
        hints: ["Use the shortcut shown below."],
        steps: [{ text: "Split the pane to the right", test: (a, b) => paneTotal(b) > paneTotal(a) }],
        doit: (api) => api.run("pane.split", { direction: "right" }),
      },
      {
        id: "split-down", title: "Split downwards", goal: 6, want: "pane.split:down",
        teach: "Or stack them. Splits nest: you can split a pane that is already half of a split.",
        hints: ["Use the shortcut shown below."],
        steps: [{ text: "Split a pane downwards", test: (a, b) => paneTotal(b) > paneTotal(a) }],
        doit: (api) => api.run("pane.split", { direction: "down" }),
      },
      {
        id: "move-focus", title: "Move between panes", goal: 6, want: "pane.go:left", minPanes: 2,
        teach: "Keyboard focus follows the pane you pick. Jump to a neighbour by direction instead of reaching for the mouse.",
        hints: ["Use the arrows variant of the shortcut: left, right, up or down."],
        steps: [{ text: "Move focus to a different pane", test: (a, b) => !!a.focused?.pane && !!b.focused?.pane && a.focused.pane !== b.focused.pane }],
        doit: (api) => api.run("pane.go", { direction: "left" }),
      },
      {
        id: "zoom", title: "Zoom in and out", goal: 10, want: "pane.zoom", minPanes: 2,
        teach: "Zoom shows just one pane of the tab, full size, without closing the others. Press it again to bring everything back.",
        hints: ["Same key to zoom and to un-zoom."],
        steps: [
          { text: "Zoom the focused pane", test: (a, b) => tabsOf(b).some((t) => t.zoomed) },
          { text: "Zoom back out", test: (a, b) => !tabsOf(b).some((t) => t.zoomed) },
        ],
        doit: (api) => api.run("pane.zoom", {}),
      },
      {
        id: "close-pane", title: "Close a pane", goal: 6, want: "pane.close", minPanes: 2,
        teach: "Closing a pane ends the terminal inside it. When a tab's last pane goes, the tab goes too.",
        hints: ["Use the shortcut shown below on a pane you don't need."],
        steps: [{ text: "Close one pane", test: (a, b) => paneTotal(b) < paneTotal(a) }],
        doit: (api) => api.run("pane.close", {}),
      },
      {
        id: "switch-space", title: "Jump between spaces", goal: 8, want: "space.next", minSpaces: 2,
        teach: "Spaces are your projects. Go to another one, then come back to the practice space.",
        hints: ["Next-space key, or Ctrl plus a number for a specific one.", "Or click a space in the sidebar."],
        steps: [
          { text: "Show a different space", test: (a, b) => { const x = a.spaces.find((s) => s.active), y = b.spaces.find((s) => s.active); return !!x && !!y && x.id !== y.id; } },
          { text: "Come back to the practice space", test: (a, b) => practiceOf(b)?.active === true },
        ],
        doit: (api, s, step) => (step === 0 ? api.run("space.next", {}) : api.run("space.select", { id: s.practice })),
      },
      {
        id: "palette", title: "Find any command", want: "app.palette", manual: "I opened it",
        teach: "You don't have to remember every shortcut. The command palette lists every command by name, with its key. Open it, look around, close it.",
        hints: ["Use the shortcut shown below and type a few letters."],
        steps: [{ text: "Open the command palette and look at a few commands", test: () => false }],
        doit: (api) => api.run("app.palette", {}),
      },
    ],
  },
  {
    id: "around",
    title: "Around the app",
    lessons: [
      {
        id: "rename-tab", title: "Name a tab", goal: 10, want: "tab.rename",
        teach: "A tab nobody named is called by its number. Name it after the task (\"fix login\") and the sidebar tells you what is where.",
        hints: ["Use the shortcut, type a name, Enter."],
        steps: [{ text: "Rename a tab of the practice space", test: (a, b) => tabsOf(b).filter((t) => t.named).length > tabsOf(a).filter((t) => t.named).length }],
        doit: (api, s) => api.run("tab.rename", { id: activeTab(s)?.id, name: "Practice tab" }),
      },
      {
        id: "picker", title: "Jump to anything", want: "mod.open:picker", manual: "I opened it", needsPractice: false,
        teach: "The picker finds a terminal, tab or space by name, from anywhere. Open it, type a few letters, close it again.",
        hints: ["Use the shortcut shown below."],
        steps: [{ text: "Open the picker and look around", test: () => false }],
        doit: (api) => api.run("mod.open", { name: "picker" }),
      },
      {
        id: "search", title: "Search a terminal", want: "terminal.search", manual: "I searched", needsPractice: false,
        teach: "Every terminal can search its screen and scrollback. Open the find bar, type a word, step through the matches with Enter, close it with Esc.",
        hints: ["Click a terminal first so it has focus, then use the shortcut."],
        steps: [{ text: "Open the find bar in a terminal and search for a word", test: () => false }],
        doit: (api) => api.run("terminal.search", {}),
      },
    ],
  },
  {
    id: "agents",
    title: "Agents",
    lessons: [
      {
        id: "start-agent", title: "Start a practice agent", primary: "Start practice agent",
        teach: "An agent is a terminal running something like Claude Code or Codex that reports its status to Herdr. The practice agent is a tiny script that reports statuses without calling any model, so it costs nothing. (It needs macOS or Linux.)",
        hints: ["Press the button: it opens a tab in the practice space."],
        steps: [{ text: "Start the practice agent", test: (a, b) => !!demoOf(b) }],
        doit: (api, s) => api.run("tab.new", { space: s.practice, name: "Practice agent", argv: ["sh", `${api.appHome()}/mods/dojo/demo-agent.sh`] }),
      },
      {
        id: "agent-working", title: "Watch it work", goal: 15, needsDemo: true,
        teach: "Click the practice agent's tab and press Enter in it to give it a task. Its status turns to working; look for it in the sidebar. (working, blocked, done and idle are what every agent reports.)",
        hints: ["The agent's tab is called Practice agent.", "Press Enter inside that terminal."],
        steps: [{ text: "Make the practice agent start working", test: (a, b) => demoOf(b)?.status === "working" }],
        doit: (api, s) => { const d = demoOf(s); if (d) api.run("agent.focus", { terminal: d.address }); },
      },
      {
        id: "agent-blocked", title: "Spot a blocked agent", goal: 20, needsDemo: true,
        teach: "Blocked means the agent is waiting for you: a permission, a question. Herdr marks it most urgent, so a blocked agent rises to the top of a space's status. Wait a few seconds and it will ask.",
        hints: ["If it is idle, press Enter in the agent again, then wait.", "Blocked shows in the sidebar's status icon."],
        steps: [{ text: "Wait until the practice agent is blocked", test: (a, b) => demoOf(b)?.status === "blocked" }],
        doit: (api, s) => { const d = demoOf(s); if (d) api.run("agent.focus", { terminal: d.address }); },
      },
      {
        id: "agent-answer", title: "Answer it", goal: 25, needsDemo: true,
        teach: "Go to the blocked agent and press Enter to approve. It goes back to working, then to done. Done means it finished while you weren't looking; it becomes idle once you look at it.",
        hints: ["Click the agent, or use the next-agent key, then press Enter."],
        steps: [
          { text: "Approve it so it works again", test: (a, b) => demoOf(b)?.status === "working" },
          { text: "Let it finish (done or idle)", test: (a, b) => ["done", "idle"].includes(demoOf(b)?.status) },
        ],
        doit: (api, s) => { const d = demoOf(s); if (d) api.run("agent.focus", { terminal: d.address }); },
      },
      {
        id: "agent-pin", title: "Pin an agent", goal: 10, needsDemo: true, primary: "Pin it for me",
        teach: "Pinning keeps an agent at the top of the agent lists, whatever its status. Pin the practice agent from the command palette (terminal.pin) or the agent's menu.",
        hints: ["Open the palette and type pin."],
        steps: [{ text: "Pin the practice agent", test: (a, b) => demoOf(b)?.pinned === true }],
        doit: (api, s) => { const d = demoOf(s); if (d) api.run("terminal.pin", { terminal: d.address, pinned: true }); },
      },
      {
        id: "cycle-agents", title: "Cycle through agents", goal: 10, want: "agent.next", needsPractice: false,
        teach: "One key takes you to the next agent, wherever it lives, in the order the agents list shows them. It needs two running agents: the practice agent plus one of your own. Skip it if you have only one.",
        hints: ["Use the shortcut shown below."],
        steps: [{ text: "Jump to another agent", test: (a, b) => !!a.focused?.agent && !!b.focused?.agent && a.focused.agent !== b.focused.agent }],
        doit: (api) => api.run("agent.next", {}),
        skip: (s) => (s.agents < 2 ? "Needs two running agents; you have fewer." : null),
      },
      {
        id: "agent-stop", title: "Stop the agent", goal: 10, needsDemo: true, primary: "Stop it for me",
        teach: "Ending an agent's terminal also ends its sub-agents. Close the practice agent's tab or pane, or kill its terminal.",
        hints: ["Close its pane with the close-pane key."],
        steps: [{ text: "End the practice agent", test: (a, b) => !demoOf(b) }],
        doit: (api, s) => { const d = demoOf(s); if (d) api.run("terminal.kill", { terminal: d.address }); },
      },
    ],
  },
  {
    id: "worktrees",
    title: "Worktrees",
    lessons: [
      {
        id: "wt-sandbox", title: "A scratch repo", needsSandbox: true, needsPractice: false,
        teach: "Worktrees are extra checkouts of one repo, each in its own folder and branch. To practice safely, the Dojo makes a tiny scratch repo inside Herdr's config folder and opens a space in it. It never touches your real repos.",
        steps: [{ text: "The scratch repo space is open", test: (a, b) => sandboxUp(b) }],
        doit: () => {},
      },
      {
        id: "wt-new", title: "Make a worktree", goal: 20, needsSandbox: true, needsPractice: false, primary: "Make one for me",
        teach: "Right-click the scratch repo's space and pick New worktree…, type a branch name. A new space appears, nested under the repo's, with its own folder.",
        hints: ["Right-click the space in the sidebar."],
        steps: [{ text: "Create a worktree from the scratch repo", test: (a, b) => worktrees(b).length > worktrees(a).length }],
        doit: (api, s) => api.openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: s.sandbox, action: "new", branch: "dojo-demo" } }),
      },
      {
        id: "wt-look", title: "See how it nests", needsSandbox: true, needsPractice: false, manual: "I see it",
        teach: "In the Spaces sidebar, the worktree sits under its repo's space and shows its own branch and changes. Each worktree is a full space: its own tabs, terminals and agents, on its own branch.",
        steps: [{ text: "Find the worktree under its repo in the sidebar", test: () => false }],
      },
      {
        id: "wt-remove", title: "Remove it", goal: 20, needsSandbox: true, needsWorktree: true, needsPractice: false, primary: "Remove it for me",
        teach: "Remove the worktree from its space menu (Remove worktree…). That deletes its folder and closes the space; the branch stays in the repo.",
        hints: ["Right-click the worktree's space."],
        steps: [{ text: "Remove the worktree", test: (a, b) => worktrees(b).length < worktrees(a).length }],
        doit: (api, s) => { const w = worktrees(s)[0]; if (w) api.openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: w.id, action: "remove" } }); },
      },
    ],
  },
  {
    id: "customize",
    title: "Make it yours",
    lessons: [
      {
        id: "theme", title: "Change the theme", goal: 15, needsPractice: false, primary: "Switch it for me",
        teach: "Herdr ships a few themes (graphite, ink, moss, paper) and loads yours from themes/. Switch to a different one in Settings → Look or from the palette (app.theme), then switch back.",
        hints: ["Open settings with the palette: type settings."],
        steps: [
          { text: "Switch to a different theme", test: (a, b) => a.themeSig !== b.themeSig },
          { text: "Switch back to the one you had", test: (a, b) => a.themeSig === b.themeSig },
        ],
        doit: (api, s, step, start) => {
          if (step === 0) api.run("app.theme", { name: themeOf(s) === "paper" ? "ink" : "paper" });
          else { const t = themeOf(start); if (t) api.run("app.theme", { name: t }); }
        },
      },
      {
        id: "zoom-app", title: "Make everything bigger", goal: 10, want: "app.zoom_in", needsPractice: false,
        teach: "The whole app scales: sidebar, tabs and terminals. Zoom in, then reset to normal size.",
        hints: ["Zoom in with the shortcut below; the reset key is in the palette (app.zoom_reset)."],
        steps: [
          { text: "Zoom in or out", test: (a, b) => a.look !== b.look && a.themeSig === b.themeSig },
          { text: "Back to normal size", test: (a, b) => a.look === b.look },
        ],
        doit: (api, s, step) => api.run(step === 0 ? "app.zoom_in" : "app.zoom_reset", {}),
      },
      {
        id: "layout-switch", title: "Switch layout", want: "layout.switch", needsPractice: false, manual: "I switched and came back",
        teach: "A layout is a whole window: sidebar, tab bar, panels. Cycle through them and come back. Switching layouts closes floating windows like this one, so reopen the Dojo afterwards.",
        hints: ["Press the shortcut once or twice until you see a different window, then press it until you return."],
        steps: [{ text: "Switch to another layout and back", test: () => false }],
        doit: (api) => api.run("layout.switch", {}),
      },
      {
        id: "sidebar", title: "Hide a panel", want: "layout.toggle:sidebar", needsPractice: false, manual: "I toggled it",
        teach: "Any layout block can be hidden and shown again with layout.toggle. The default sidebar's key does it; some layouts name their blocks differently.",
        hints: ["Use the shortcut below. Press it again to bring the panel back."],
        steps: [{ text: "Hide and show the sidebar", test: () => false }],
        doit: (api) => api.run("layout.toggle", { id: "sidebar" }),
      },
      {
        id: "bind-key", title: "Bind your own key", goal: 60, needsPractice: false,
        teach: "Shortcuts live in keys.json, in the Herdr config folder. Add one under \"global\", for example \"ctrl-shift-j\": \"space.next\" (pick a free combination), then save. Herdr reloads it by itself.",
        hints: ["Open ~/.config/herdr-app/keys.json in any editor.", "Keep the JSON valid: commas between entries."],
        steps: [{ text: "Add or change a key binding in keys.json", test: (a, b) => a.keysSig !== b.keysSig }],
      },
      {
        id: "settings", title: "Open the settings", want: "app.settings", needsPractice: false, manual: "I opened it",
        teach: "Settings has Look, Alerts, Machines and Updates. Have a look around, then close it.",
        steps: [{ text: "Open the settings and look around", test: () => false }],
        doit: (api) => api.run("app.settings", {}),
      },
    ],
  },
  {
    id: "organize",
    title: "Organize your work",
    lessons: [
      {
        id: "swap", title: "Swap two panes", goal: 10, want: "pane.swap:left", minPanes: 2,
        teach: "Move a pane to where its neighbour is: swap exchanges the two. Handy to put the terminal you watch next to the one you type in.",
        hints: ["Use the swap shortcut: left, right, up or down."],
        steps: [{ text: "Swap the focused pane with its neighbour", test: (a, b) => paneOrder(a) !== paneOrder(b) }],
        doit: (api) => api.run("pane.swap", { direction: "left" }),
      },
      {
        id: "move-tab", title: "Reorder tabs", goal: 15, minTabs: 2, primary: "Move one for me",
        teach: "Drag a tab in the tab bar, or run tab.move from the palette, to put it where you want it.",
        hints: ["Drag a tab left or right in the tab bar."],
        steps: [{ text: "Change the order of the practice space's tabs", test: (a, b) => tabOrder(a) !== tabOrder(b) }],
        doit: (api, s) => { const t = tabsOf(s); if (t.length > 1) api.run("tab.move", { id: t[0].id, index: t.length }); },
      },
      {
        id: "settle", title: "Put a tab away", goal: 15, minTabs: 2,
        teach: "Settling a tab hides it from the lists without stopping it. A tab comes back by itself if an agent in it needs you. Use tab.settle from the palette, then tab.unsettle.",
        hints: ["Open the palette and type settle."],
        steps: [
          { text: "Settle a tab", test: (a, b) => tabsOf(b).some((t) => t.settled) },
          { text: "Bring it back", test: (a, b) => !tabsOf(b).some((t) => t.settled) },
        ],
        doit: (api, s, step) => {
          const t = tabsOf(s);
          if (step === 0) { const x = t.find((y) => !y.active) ?? t[0]; if (x) api.run("tab.settle", { id: x.id }); }
          else t.filter((y) => y.settled).forEach((y) => api.run("tab.unsettle", { id: y.id }));
        },
      },
      {
        id: "move-space", title: "Reorder spaces", goal: 15, minSpaces: 2, primary: "Move it for me",
        teach: "Drag a space in the sidebar to put it where you want it (or run space.move). Order is manual unless your sidebar sorts for you.",
        hints: ["Drag the practice space up or down."],
        steps: [{ text: "Change the practice space's position", test: (a, b) => practiceOf(a)?.index !== practiceOf(b)?.index }],
        doit: (api, s) => { const p = practiceOf(s); if (p) api.run("space.move", { id: p.id, index: p.index === 1 ? 2 : 1 }); },
      },
    ],
  },
  {
    id: "machines",
    title: "Other machines",
    lessons: [
      {
        id: "machine-add", title: "Add a machine", skippable: true,
        teach: "A space can live on another computer you reach over ssh. Add one in Settings → Machines, or run `hc machine add <host>` in a terminal. Skip this if you don't have another machine.",
        hints: ["Any host from your ~/.ssh/config works."],
        steps: [{ text: "Add a machine", test: (a, b) => b.machines.length > a.machines.length }],
        skip: () => null,
      },
      {
        id: "machine-space", title: "A space over there", goal: 15, primary: "Make one for me",
        teach: "With a machine added, make a space on it from the + menu, or space.new with a machine. Its terminals and tabs live on that computer; the sidebar labels it.",
        steps: [{ text: "Open a space on another machine", test: (a, b) => remote(b).length > remote(a).length }],
        doit: (api, s) => { if (s.machines[0]) api.run("space.new", { machine: s.machines[0] }); },
        skip: (s) => (s.machines.length ? null : "You have no other machine added."),
      },
    ],
  },
  {
    id: "mods",
    title: "Your own mods",
    lessons: [
      {
        id: "mod-clone", title: "Clone a mod", goal: 15, needsPractice: false, needsMods: true, primary: "Clone it for me",
        teach: "Everything in Herdr is a mod, and the shipped ones can be copied before you edit them. Clone this Dojo as dojo-practice (mod.clone from the palette): a copy appears in your mods folder.",
        hints: ["Open the palette, type mod.clone, give the name dojo and the copy name dojo-practice."],
        steps: [{ text: "Clone the dojo mod as dojo-practice", test: (a, b) => (b.mods ?? []).includes("dojo-practice") }],
        doit: (api) => api.run("mod.clone", { name: "dojo", as: "dojo-practice" }),
      },
      {
        id: "mod-look", title: "Look inside", needsPractice: false, manual: "I looked",
        teach: "Open ~/.config/herdr-app/mods/dojo-practice/lessons.js in an editor and change a lesson's title. Mods reload as you save. The guide that explains everything is AGENTS.md in the same folder.",
        steps: [{ text: "Open the copy's files and edit something", test: () => false }],
      },
      {
        id: "mod-remove", title: "Clean up", needsPractice: false, needsMods: true, primary: "Remove the copy",
        teach: "Remove the copy you made. This only deletes the dojo-practice folder.",
        steps: [{ text: "Remove the dojo-practice folder", test: (a, b) => !(b.mods ?? []).includes("dojo-practice") }],
        doit: (api) => api.exec("rm", ["-rf", `${api.appHome()}/mods/dojo-practice`]),
      },
    ],
  },
];
