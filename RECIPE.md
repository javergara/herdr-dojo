# Herdr Dojo

A floating practice window that teaches Herdr by making you do it. Each lesson asks for one real action (make a space, split a pane, zoom…) and ticks itself off the moment Herdr's own state shows you did it. The shortcuts it shows are read from *your* `keys.json`, so it teaches the keys you actually have.

![Herdr Dojo](preview.png)

## What you see

A 400 × 640 px window (draggable, over the layout, not modal) with three parts, top to bottom:

- **Header** (flex-none): the title `Herdr Dojo` in 15px bold, `done / total` at the right in 11.5px `dim`, the line `Chapter 1 of 2 · Spaces, tabs & splits` (the chapter of the first unfinished lesson), a `×` at the top right that closes the window, and a 4px progress bar (`raised` track, `accent` fill).
- **Lesson list** (scrolls): 14 lessons in two chapters (`CHAPTER 1 · SPACES, TABS & SPLITS`, `CHAPTER 2 · AROUND THE APP`, 10.5px `dim` headings), one card each. A done lesson shows a green `✓` and its best time; a locked lesson is dimmed; the current lesson is an expanded card with a 1px border on `surface`.
- **Footer** (flex-none, top border): `Close practice space` and `Reset progress` buttons. When all 14 are done it also says `All chapters complete · <total time> in total`.

An expanded card shows: the lesson text (12.5px `muted`), `YOUR SHORTCUT` with one keycap per key (22px high, `raised`, 1px `border`, rounded 6), `YOUR TURN` with a checklist, and buttons.

## How it behaves

- **Start / setup:** clicking a lesson (or `Start`, or `Next lesson →`) prepares the practice space, then takes a snapshot of Herdr's state and begins. Lessons are unlocked in order; finished ones can be replayed.
- **Practice space:** lesson 1 creates a space and the mod remembers its id. Later lessons only count things that happen there (tabs, panes, zoom) and select it first. If it was closed, the next lesson makes a new one (`space.new {name: "Dojo practice"}`).
- **Detection:** a 400 ms timer reads `spaces()`, `panes()` and `focused()` and compares them with the snapshot. Steps are ticked in order (`○` pulsing → `✓` green). A lesson with two steps (zoom in, then out; leave a space, then come back) ticks one after the other. Nothing listens to keystrokes, so it works with any bound key, and also if the action is done with the mouse.
- **Do it for me:** runs the lesson's command (`space.new`, `tab.next`, `pane.split {direction}`, `pane.zoom`, …) so you see it once; it still counts as done.
- **Manual lessons:** opening the command palette and the picker cannot be detected, so they have an `I opened it` button.
- **Skippable lesson:** `Cycle through agents` needs two running agents (`agents().length`); with fewer it says so and shows `Skip` (the lesson is stored as `skipped`).
- **Chapter 2** (`Around the app`): name a tab (`tab.rename`), cycle agents (`agent.next`), open the picker (`mod.open:picker`).
- **Shortcuts shown:** for each lesson's command it reads `keys()`, takes the global binding first, and splits the combo into keycaps (`cmd-shift-]` → `Cmd` `Shift` `]`). With no binding it says so and points at the palette.
- **Done:** the card turns its border green (`ansi2` at 53%), prints `Done in 12s`, and offers `Next lesson →`.
- **Progress:** `{done: {lessonId: {ms, best}}, practice}` in `localStorage` key `dojo.v1`. `Reset progress` (two clicks) clears it; `×` calls `closeOverlay(props().overlay)`; `Close practice space` (two clicks) runs `space.close {id, confirmed: true}` on the practice space only.

## Built from

- `mods/dojo/mod.json`: `{ "place": "none", "title": "Herdr Dojo", "overlay": { "kind": "window", "width": 400, "height": 640 } }`.
- `mods/dojo/main.js`: one `View` (`Dojo`); `init` reads progress and starts `cx.timer.every(400, …)`; `render` builds header, cards and footer with `v_flex`/`h_flex`/`div` from `gpui-kit` and `gpui-base`. Uses `spaces`, `panes`, `focused`, `keys`, `theme`, `run` from `herdr`; commands `space.new`, `space.select`, `space.close`, `tab.new`, `pane.split`.
- `mods/dojo/lessons.js`: the curriculum as data. Each lesson: `id`, `title`, `teach`, `want` (the command whose key is shown), `steps: [{text, test(start, now)}]`, `doit(run, state)`, and optional `minTabs`, `minPanes`, `minSpaces`, `needsPractice`, `adopt`, `manual`.
- Open it with `mod.open:dojo`: bind a key (e.g. `"cmd-shift-j": "mod.open:dojo"` under `global` in `keys.json`) or use the command palette. Press it again to close.
- Colors are theme names only (`foreground`, `muted`, `dim`, `raised`, `border`, `surface`, `accent`, `solid`, `ansi2`), so it follows light and dark themes.

## Watch out

- **It really creates things.** The practice space and its tabs/panes are real; that is why lesson 1 makes a dedicated space. Do not point the lessons at a space with live work. The closing button only removes the practice space.
- **State, not keystrokes.** A test passes when the state changed since the snapshot, so a lesson cannot tell *how* you did it. `Do it for me` therefore counts too.
- **Focus lessons need a second pane.** `Move between panes`, `Zoom` and `Close a pane` add panes themselves before starting (`minPanes: 2`); `Hop between tabs` adds a tab (`minTabs: 2`); `Jump between spaces` needs two spaces (`minSpaces: 2`).
- **Don't rename `dojo.v1`** if you want existing progress to survive an update.
- It shows `Cmd`, `Ctrl`, `Alt`, `Shift` as words on every OS rather than platform glyphs.
- Closing and reopening the window keeps progress but not the half-finished lesson; the lesson restarts from its snapshot.

## Done when

1. `herdr-app check mods/dojo` passes, and `mod.open:dojo` opens a window with the header at `0 / 14` and lesson 1 expanded.
2. Lesson 1 shows the keycaps for the key bound to `space.new` in the person's `keys.json`; after unbinding it, it shows the `No key is bound` text.
3. Pressing `Start` and then making a space ticks the step within about half a second, prints `Done in …`, and `Next lesson →` starts lesson 2 in that new space.
4. Splitting a pane ticks lesson 5 whether done by key, by `Do it for me`, or with the mouse.
5. Zoom shows two steps: it ticks the first when a pane is zoomed and the second when un-zoomed.
6. `Reset progress` needs two clicks and returns to `0 / 14`; `Close practice space` closes only that space.
