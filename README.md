# Herdr Dojo

Learn [Herdr](https://herdr.dev) by doing it. A small floating window gives you short lessons; each one asks for a real action (make a space, open a tab, split a pane, pin an agent, add a worktree…) and checks itself off the moment Herdr's own state shows you did it. The shortcuts it teaches come from your own `keys.json`.

![Herdr Dojo](preview.png)

**40 lessons in 8 chapters**, in English and Spanish (the `EN`/`ES` chip):

1. Spaces, tabs & splits
2. Around the app
3. Agents (with a practice agent that costs nothing: it only reports statuses)
4. Worktrees (in a scratch repo of its own, never yours)
5. Make it yours (themes, zoom, layouts, your own keys)
6. Organize your work
7. Other machines
8. Your own mods

Along the way: gold and silver medals for beating each lesson's time without help, progressive hints, a *Practice* button that replays something you've done, and a few trophies.

## Install

Ask your agent: "Read ~/.config/herdr-app/AGENTS.md, then add this mod: `mods/dojo` from this repo", or copy the folder to `~/.config/herdr-app/mods/dojo/` yourself and run:

```sh
herdr-app check ~/.config/herdr-app/mods/dojo
```

Open it with `mod.open:dojo` from the command palette, or bind a key in `keys.json`:

```json
{ "global": { "cmd-shift-j": "mod.open:dojo" } }
```

(The same snippet is in `keys.json`. Merge it into your own file; don't replace yours.)

## Good to know

- Lesson 1 makes a **practice space**; the other lessons only touch what the Dojo made. `Clean up` removes the practice space, the scratch repo and anything else it created.
- Chapter 3 runs a tiny `sh` script, so it needs macOS or Linux (you can skip it on Windows).
- Progress is stored in the mod's `localStorage`. `Reset progress` clears it.
- Nothing is sent anywhere; the mod only reads Herdr's local state and runs local commands.

## Develop

```sh
node tests/lessons.test.mjs   # every lesson's detection, plus Spanish coverage; no dependencies
```

- `mods/dojo/lessons.js`: the curriculum, as data. Each lesson has `steps` with a `test(start, now)` over Herdr's state.
- `mods/dojo/es.js`: the Spanish text. Add a language by copying it.
- `mods/dojo/main.js`: the window and the engine.
- `mods/dojo/demo-agent.sh`: the practice agent.
- `RECIPE.md`: a brief another agent can rebuild the mod from.

## License

MIT. See [LICENSE](LICENSE).
