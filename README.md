# Medieval Battle and Medieval II Asset Lab

The hosted page is immediately playable without file selection. It uses procedural soldiers and prototype battle rules. On this PC, `START.cmd` detects the installed Steam game, opens a menu built with original game artwork/text, and reads meshes/textures directly from its six local PACK files; the battle shows 10 real unit/faction models. Nothing is extracted, uploaded, or included in the repository. Prototype combat rules are **not reconstructed Medieval II combat**.

Hosted prototype: <https://agamer21.github.io/medieval2-web/>. Source: <https://github.com/agamer21/medieval2-web>. Click **Begin battle**, select a blue regiment and right-click to move/attack. Touch users select a card then tap the map. Controls explains keyboard shortcuts and tactics. Shared AG Arcade online presence uses anonymous Firebase authentication.

The preserved [original-asset viewer](https://agamer21.github.io/medieval2-web/lab.html) is optional research tooling. The local launcher auto-detects the default Steam installation; hosted browsers retain folder selection as a security-limited fallback. Original files stay local.

## Open it on this PC

Run `START.cmd`. It starts the loopback server and opens the local main menu at <http://127.0.0.1:8872/menu.html>. Choose **Single Player → Custom Battle** to play at <http://127.0.0.1:8872/>. The asset viewer is at <http://127.0.0.1:8872/lab.html>.

The local server reads PACK files through bounded byte-range requests and only serves game assets from loopback. The viewer auto-loads 1,980 searchable model/faction entries with LOD selection. It uses original idle/walk/run clips for Spear Militia. The main and Single Player screens use the actual main-menu artwork and English string table; the other screens are still being ported. The local launcher needs no file or folder picker.

To rebuild the private sample assets from the installed Steam copy, run `PREPARE.cmd`. This uses the game's shipped unpacker in a separate work folder. It never extracts into the Steam installation. Python 3.11+ is required; no Python packages are needed. Node is used only for tests.

The expected installation is `C:\Program Files (x86)\Steam\steamapps\common\Medieval II Total War`. The private sample data lives in the containing workspace's `work/medieval2/private-assets`, outside this code folder.

## Original-asset viewer behavior

- Original spear-militia geometry: 3,263 vertices, 22 source groups, 26 bone-name entries.
- England and France use the exact body/attachment diffuse paths in `battle_models.modeldb`.
- Original idle, walk and run animation records plus spear/shield attachment rigs are decoded. Quaternion interpolation and skinning are new code; playback is interpreted at 20 fps and has not been compared with the native engine.
- Direct folder mode indexes 36,159 members in six original archives using about 3.87 MB of archive metadata. It reads selected compressed blocks and animation-record ranges, rather than loading whole gigabyte archives into memory. The direct archive decoder matched the official unpacker byte-for-byte on 20 files.
- Model variants, wireframe/normals, orbit/zoom/WASD camera, pause/resume and file loading.
- Original unit-definition fields for Spear Militia are read from the selected installation and displayed as raw source values. Attack, armour and morale rules are not simulated.
- A rendering experiment draws 1, 16, 64 or 256 copies. Copies share a pose. Right-click movement is prototype formation translation; it is not native pathfinding or combat.
- Local battle currently renders 10 original England/French spear, infantry, archer and knight model/faction entries. They are static bind poses in battle; animation blending is still being ported.
- The floor, lighting, camera, browser UI and movement logic are new. They do not establish visual or behavioral parity with Medieval II.

## Original-asset viewer controls

Drag to orbit; scroll to zoom; WASD to pan; R to reframe. Right-click the reference floor to move the test formation. Use the selectors for faction, geometry variant, original clip and copy count. The animation pause button freezes clip time.

## Verification

Run `node --test tests/*.test.mjs` for simulation, archive, modeldb, texture and skinning checks. The real browser run covers the hosted battle through victory/restart and the local original-model viewer without file selection. These checks do not establish native engine parity.

Screenshots and browser test scripts live in the containing workspace's `outputs` and `work/medieval2` folders. These checks establish the local prototype's behavior, not original-engine parity or battle gameplay.

## Boundaries

No game assets or original executable/DLLs are included in this code package or the public website/repository. The private unpacker, samples and research references stay in `work/`. The local server binds only to `127.0.0.1`; original asset requests never leave this PC. The original game has not been launched by this work.

Native combat, campaign simulation, native AI, original terrain/map decoding, original audio, collision/pathfinding, native saves and most original menus remain unimplemented. The main and Single Player menu artwork/text are recovered, but their screen flows are not yet complete. Battle models are static bind poses. The playable prototype is one flat, freely traversable battlefield with regiment-level damage, not the original engine.

See `RESEARCH.md` for evidence and next steps, and `THIRD-PARTY.md` for dependency/source provenance.
