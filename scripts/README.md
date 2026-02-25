# Maze converter

Convert readymade Pac-Man maze files (e.g. Berkeley `.lay`) into Hungergame’s format.

## Input format

- One line = one row, one character = one cell.
- Common convention (Berkeley/Stanford):
  - `%` = wall  
  - `.` = food (pellet)  
  - `o` = power pellet  
  - `P` = Pac-Man start  
  - `G` = ghost start  

The converter maps: `%` and `#` → `W`, `.` → `.`, `o`/`O` → `o`, `P` → `P`, `G` → `G`, space → space. Unknown characters become `.`. A gate `-` is added on the ghost row if missing.

## Node script

From the project root:

```bash
node scripts/convert-maze.js path/to/layout.lay
```

Options:

- `--name "Level Name"` – name for the level (default: filename without extension).
- `-o mazes.json` – write converted maze(s) to a JSON file.

Example:

```bash
node scripts/convert-maze.js scripts/sample.lay --name "Tiny" -o mazes.json
```

Output: validation messages (if any), path to written file (if `-o`), and a JS snippet you can paste into `LEVELS` in `src/game.js`.

## Browser converter

Open `converter.html` in a browser (e.g. double‑click or `file:///.../converter.html`). Drop a `.lay` or `.txt` file (or click to choose). Optionally set the level name, then copy the JS snippet or download `mazes.json`.

## Using converted mazes in the game

1. **Paste into LEVELS:** Copy the printed JS snippet and add it as a new element in the `LEVELS` array in `src/game.js` (e.g. after an existing level).
2. **Load from JSON:** If you use `-o mazes.json` or download from the browser, you can later add code in the game to `fetch('mazes.json')` and merge the array into `LEVELS` at load time.
