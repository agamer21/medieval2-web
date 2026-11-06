# Evidence ledger

## Installed copy

Steam app 4700, Total War: MEDIEVAL II — Definitive Edition, finished installation during the session. The installed `medieval2.exe` is a 19,673,088-byte x86 PE32 application with SHA-256 `ac75b431803ccfb1a63a9936603e5503b61f1fd7b4bc7dc1bf2991c73fd6c3ab`.

Static imports include Direct3D 9/D3DX9, DirectInput, Win32, Steam API, Miles audio, Bink and Granny. Imports are dependency evidence, not observations of runtime behavior. The native game was not launched.

The installed game ships an unpacker supporting a file-list mode, output-directory selection and wildcard filters. A copied tool/runtime was used outside Steam. Base-game archives and the executable retained their sizes and modification times across extraction. Detailed static/import and extraction evidence is private under `work/medieval2/`.

REA's current Windows Ghidra integration rejected the 32-bit unpacker: its Windows provider admits x86-64 PE targets only. No binary was opened in a deep-analysis session. The project used static PE parsing and format-aware data inspection instead; no engine decompilation is claimed.

## Verified data paths

- `data/unit_models/_units/en_peasant_padded/spear_militia_lod0.mesh`: actual Boost-serialized model, 3,263 vertices, 22 groups and 26 bone-name entries. Indices reference one shared vertex pool. The viewer chooses one variant per group category.
- Body texture and attachment texture paths are selected from the actual `battle_models.modeldb` entry for spear militia and faction. DDS images in the tested `.texture` files start at the header-declared byte offset 48. DXT decoding is validated on four real files and synthetic edge cases.
- Native `data/Animations/pack.idx` and `skeletons.idx` index records into sibling DAT files. The selected body rig has 20 bones. Native idle/walk/run clips have 41/19/15 frames respectively. Two-bone spear and shield rigs and their original clip records are also used.
- The viewer reflects the native Z axis for the renderer, reverses triangle winding and decodes the packed bone-index channel. The two diffuse sheets are sampled side-by-side using original UVs. Bone slot aliases are matched to body and attachment rigs.

## What is not established

Direct browser archive reading has since passed an additional oracle check: all 20 selected original files were byte-for-byte identical to the official unpacker's output. The browser folder-picker test bypassed the prepared-asset endpoint entirely and loaded original geometry, both faction textures and native animation records from the selected installation, without uploads or external requests. The six base archives contain 36,159 indexed members; 3,870,640 metadata bytes were read to index them.

No full battle, game rules, combat timing, AI, original audio, original terrain, campaign or save compatibility has been reconstructed. No native-versus-browser behavioral comparison has occurred. Current lighting, floor and camera are authored for inspection. Frame-rate labels describe this browser run, not cross-device performance guarantees.

## Engine route

The checked public M2TWEOP source modifies the running game. The checked M2EX repository does not provide the engine source needed for a direct browser build. A separate original-engine reconstruction or an adequate compatibility runtime is still needed for a faithful game.

Boxedwine's current source changelog advertises new Direct3D-to-WebGL work, but the downloadable 26R1 web release README explicitly says its Web/Emscripten build does not support OpenGL or Direct3D. That release is not sufficient evidence that Medieval II can run. The installed binary also imports Steam APIs; successful browser initialization/authentication is untested. No Steam or executable checks have been patched or bypassed.

## Next useful milestones

1. Done: direct browser PACK/LZO reading and selected-file/range decoding, checked against the official extractor and with a real browser directory selection. Windows-only extraction is now optional for this viewer.
2. Capture native reference scenes and timing only after an authorized native first run, preserving configuration/saves.
3. Verify exact model variant, attachment and animation selection against that reference.
4. Establish a buildable engine or viable compatibility route before implementing purported native battle behavior.
