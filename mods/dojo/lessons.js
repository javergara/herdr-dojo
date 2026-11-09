// Herdr Dojo — chapter 1: spaces, tabs and splits.
//
// A lesson is a few `steps`. Each step has a `test(start, now)` that reads the live state of Herdr and says
// whether the person did what was asked, so nothing here listens to keystrokes: it works with whatever keys
// the person bound. `start` is a snapshot taken when the lesson began, `now` is the current one.
//
// state = { spaces: SpaceInfo[], panes: PaneInfo[], focused, agents: number, practice }   (practice = the practice space, or null)

export const practiceOf = (s) => s.spaces.find((x) => x.id === s.practice) ?? null;
const tabsOf = (s) => practiceOf(s)?.tabs ?? [];
const paneTotal = (s) => tabsOf(s).reduce((n, t) => n + t.panes, 0);
const activeTab = (s) => tabsOf(s).find((t) => t.active) ?? null;

// Each lesson names the command whose shortcut it teaches (looked up in the person's own keys.json),
// and `doit` performs it for them when they'd rather watch.
export const CHAPTERS = [
  {
    id: "basics",
    title: "Spaces, tabs & splits",
    blurb: "The three levels everything in Herdr is built on.",
    lessons: [
      {
        id: "new-space",
        title: "Make a space",
        teach: "A space is a place to work: usually one project. Each space has its own tabs and terminals. You'll practice in a space of your own, so nothing real gets touched.",
        want: "space.new",
        // the new space becomes the practice space
        steps: [{ text: "Create a new space", test: (a, b) => b.spaces.length > a.spaces.length }],
        adopt: (a, b) => b.spaces.find((x) => !a.spaces.some((y) => y.id === x.id))?.id ?? null,
        doit: (run) => run("space.new", { name: "Dojo practice" }),
        needsPractice: false,
      },
      {
        id: "rename-space",
        title: "Name it",
        teach: "A space nobody named is called after its folder. Give it a name that says what you're doing there.",
        want: "space.rename",
        steps: [{ text: "Rename the practice space", test: (a, b) => { const p = practiceOf(b); return !!p && p.named && p.name !== practiceOf(a)?.name; } }],
        doit: (run, s) => run("space.rename", { id: s.practice, name: "Practice" }),
      },
      {
        id: "new-tab",
        title: "Open a tab",
        teach: "A tab is one piece of work inside a space: a bug fix, a review, a long-running server. Open one more.",
        want: "tab.new",
        steps: [{ text: "Open a new tab in the practice space", test: (a, b) => tabsOf(b).length > tabsOf(a).length }],
        doit: (run, s) => run("tab.new", { space: s.practice }),
      },
      {
        id: "switch-tab",
        title: "Hop between tabs",
        teach: "Move between the tabs of a space without touching the mouse. The next-tab key cycles; the number keys jump straight to one.",
        want: "tab.next",
        steps: [
          { text: "Go to another tab", test: (a, b) => { const x = activeTab(a), y = activeTab(b); return !!x && !!y && x.id !== y.id; } },
        ],
        doit: (run) => run("tab.next", {}),
        minTabs: 2,
      },
      {
        id: "split-right",
        title: "Split to the right",
        teach: "A tab can hold several terminals side by side. Split the one you're in to put a second beside it.",
        want: "pane.split:right",
        steps: [{ text: "Split the pane to the right", test: (a, b) => paneTotal(b) > paneTotal(a) }],
        doit: (run) => run("pane.split", { direction: "right" }),
      },
      {
        id: "split-down",
        title: "Split downwards",
        teach: "Or stack them. Splits nest: you can split a pane that is already half of a split.",
        want: "pane.split:down",
        steps: [{ text: "Split a pane downwards", test: (a, b) => paneTotal(b) > paneTotal(a) }],
        doit: (run) => run("pane.split", { direction: "down" }),
      },
      {
        id: "move-focus",
        title: "Move between panes",
        teach: "Keyboard focus follows the pane you pick. Jump to a neighbour by direction instead of reaching for the mouse.",
        want: "pane.go:left",
        steps: [{ text: "Move focus to a different pane", test: (a, b) => !!a.focused?.pane && !!b.focused?.pane && a.focused.pane !== b.focused.pane }],
        doit: (run) => run("pane.go", { direction: "left" }),
        minPanes: 2,
      },
      {
        id: "zoom",
        title: "Zoom in and out",
        teach: "Zoom shows just one pane of the tab, full size, without closing the others. Press it again to bring everything back.",
        want: "pane.zoom",
        steps: [
          { text: "Zoom the focused pane", test: (a, b) => tabsOf(b).some((t) => t.zoomed) },
          { text: "Zoom back out", test: (a, b) => !tabsOf(b).some((t) => t.zoomed) },
        ],
        doit: (run) => run("pane.zoom", {}),
        minPanes: 2,
      },
      {
        id: "close-pane",
        title: "Close a pane",
        teach: "Closing a pane ends the terminal inside it. When a tab's last pane goes, the tab goes too.",
        want: "pane.close",
        steps: [{ text: "Close one pane", test: (a, b) => paneTotal(b) < paneTotal(a) }],
        doit: (run) => run("pane.close", {}),
        minPanes: 2,
      },
      {
        id: "switch-space",
        title: "Jump between spaces",
        teach: "Spaces are your projects. Go to another one, then come back to the practice space.",
        want: "space.next",
        steps: [
          { text: "Show a different space", test: (a, b) => { const x = a.spaces.find((s) => s.active), y = b.spaces.find((s) => s.active); return !!x && !!y && x.id !== y.id; } },
          { text: "Come back to the practice space", test: (a, b) => practiceOf(b)?.active === true },
        ],
        doit: (run) => run("space.next", {}),
        minSpaces: 2,
      },
      {
        id: "palette",
        title: "Find any command",
        teach: "You don't have to remember every shortcut. The command palette lists every command by name, with its key. Open it, look around, close it.",
        want: "app.palette",
        manual: "I opened it",
        steps: [{ text: "Open the command palette and look at a few commands", test: () => false }],
        doit: (run) => run("app.palette", {}),
      },
    ],
  },
  {
    id: "around",
    title: "Around the app",
    blurb: "Names, agents and quick jumps.",
    lessons: [
      {
        id: "rename-tab",
        title: "Name a tab",
        teach: "A tab nobody named is called by its number. Name it after the task (\"fix login\") and the sidebar tells you what is where.",
        want: "tab.rename",
        steps: [{ text: "Rename a tab of the practice space", test: (a, b) => tabsOf(b).filter((t) => t.named).length > tabsOf(a).filter((t) => t.named).length }],
        doit: (run, s) => run("tab.rename", { id: activeTab(s)?.id, name: "Practice tab" }),
      },
      {
        id: "cycle-agents",
        title: "Cycle through agents",
        teach: "An agent is a terminal running something like Claude Code or Codex that reports its status. One key takes you to the next agent, wherever it lives. It needs two agents running; if you have fewer, skip it.",
        want: "agent.next",
        needsPractice: false,
        minAgents: 2,
        steps: [{ text: "Jump to another agent", test: (a, b) => !!b.focused?.agent && a.focused?.agent !== b.focused.agent }],
        doit: (run) => run("agent.next", {}),
      },
      {
        id: "picker",
        title: "Jump to anything",
        teach: "The picker finds a terminal, tab or space by name, from anywhere. Open it, type a few letters, close it again.",
        want: "mod.open:picker",
        manual: "I opened it",
        needsPractice: false,
        steps: [{ text: "Open the picker and look around", test: () => false }],
        doit: (run) => run("mod.open", { name: "picker" }),
      },
    ],
  },
];
