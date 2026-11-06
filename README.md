# Medieval II Asset Lab

A local research prototype that loads original Medieval II geometry, faction textures and selected animation records. It is **not a port of the original game engine**.

Hosted prototype: <https://agamer21.github.io/medieval2-web/>. Source: <https://github.com/agamer21/medieval2-web>. Choose **Use installed game folder** to read your own copy directly. The hosted site contains code only. Its AG Arcade online badge uses anonymous Firebase presence; game files stay local.

## Open it on this PC

Run `START.cmd`, then open <http://127.0.0.1:8872/>. The preparation work has already been completed in this workspace. If that address is already running, simply open it.

You can also click **Use installed game folder** and select the Medieval II installation. The browser reads the original PACK/LZO archives and the loose animation index/DAT records directly. Nothing is uploaded, and no unpacker or prepared samples are required for this mode. Reselect the folder after reloading the page. A normal static web server can serve the code-only folder using this mode.

To rebuild the private sample assets from the installed Steam copy, run `PREPARE.cmd`. This uses the game's shipped unpacker in a separate work folder. It never extracts into the Steam installation. Python 3.11+ is required; no Python packages are needed. Node is used only for tests.

The expected installation is `C:\Program Files (x86)\Steam\steamapps\common\Medieval II Total War`. The private sample data lives in the containing workspace's `work/medieval2/private-assets`, outside this code folder.

## Current behavior

- Original spear-militia geometry: 3,263 vertices, 22 source groups, 26 bone-name entries.
- England and France use the exact body/attachment diffuse paths in `battle_models.modeldb`.
- Original idle, walk and run animation records plus spear/shield attachment rigs are decoded. Quaternion interpolation and skinning are new code; playback is interpreted at 20 fps and has not been compared with the native engine.
- Direct folder mode indexes 36,159 members in six original archives using about 3.87 MB of archive metadata. It reads selected compressed blocks and animation-record ranges, rather than loading whole gigabyte archives into memory. The direct archive decoder matched the official unpacker byte-for-byte on 20 files.
- Model variants, wireframe/normals, orbit/zoom/WASD camera, pause/resume and file loading.
- A rendering experiment draws 1, 16, 64 or 256 copies. All copies share a pose. Right-click movement is prototype formation translation; it is not native pathfinding or combat.
- The floor, lighting, camera, browser UI and movement logic are new. They do not establish visual or behavioral parity with Medieval II.

## Controls

Drag to orbit; scroll to zoom; WASD to pan; R to reframe. Right-click the reference floor to move the test formation. Use the selectors for faction, geometry variant, original clip and copy count. The animation pause button freezes clip time.

## Verification

Run `npm test` for format, malformed-input and weighted-skinning checks. Tests use private installed samples when available. The recorded pass on this PC included 14 original models, four original textures, five animation records and the native bone hierarchy. Real Chrome also exercised faction/variant changes, clip playback, pause/resume, 256 animated copies, movement/reset, invalid-file recovery, mobile width and zero external network requests.

Screenshots and browser test scripts live in the containing workspace's `outputs` and `work/medieval2` folders. These checks establish the local prototype's behavior, not original-engine parity or battle gameplay.

## Boundaries

No game assets or original executable/DLLs are included in this code package or the public website/repository. The private unpacker, samples and research references stay in `work/`. The local server binds only to `127.0.0.1`. No original game files have been published or uploaded. The original game has not been launched by this work.

Combat, campaign simulation, native AI, terrain/map decoding, original audio, collision/pathfinding, native save files and original UI/gameplay remain unimplemented.

See `RESEARCH.md` for evidence and next steps, and `THIRD-PARTY.md` for dependency/source provenance.
