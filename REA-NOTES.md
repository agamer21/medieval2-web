# Native investigation — November 6, 2026

REA CLI `inspect-pe-resources` inspected the actual installed PE32 executable without executing it. Evidence `ev_a7bbdd2b7d72fb8073ca3f0a044d89dd6b236ee73ac812302f5bd5eb85e068fc` records 56 resources and five icon groups, with 119 resource-directory entries examined. Non-icon payloads remain opaque; this is resource/identity evidence, not game logic.

The REA Windows Ghidra adapter still rejects x86 targets. A separate existing standalone Ghidra installation was therefore used on a private copy of the executable. This did not alter REA's admission rules or the original game file.

That initial analysis was bounded at 180 seconds and **timed out before completion**. Its discovered function count is not a complete or independently verified engine inventory. The saved private analysis project was then used without another full analysis pass to validate literal-pointer candidates against decoded instruction operands.

Results: 106 raw string candidates concerning morale, fatigue, unit-stat tags and pathfinding; 41 anchors with validated instruction references; four successfully decompiled candidate procedures. The first selected procedures include data initialization/checksum/debug-related code. They do not establish the combat or pathfinding algorithms.

Pseudocode, copied binaries, Ghidra project files and raw evidence remain in the private workspace, outside this repository and website. No native game execution or native-versus-browser gameplay comparison occurred. All conclusions are static and inferred at this stage.

Next: prioritize references to the unit-definition tags, distinguish parsing/state serialization from the actual battle updates, and validate behavior against native reference scenes before claiming implementation parity.

## Playable milestone and further static investigation

The new default battle is an original procedural implementation, independent of the native asset viewer at `lab.html`. Its damage, range, morale, fatigue and AI rules are prototype tuning. Static leads were not treated as native combat specifications.

REA opened the copied executable and confirmed its identity, but `resolve_containing_procedure` again reported `architecture_unsupported`: the Windows Ghidra adapter accepts x86-64 PE only. The REA session was closed. No provider configuration or original executable was changed.

Separately, a targeted no-analysis pass on the saved standalone Ghidra project successfully decompiled three more functions: `008e46b0` (2,848 database body bytes, 152 call sites), `00ddf050` (208 bytes, three call sites), and `00e1c230` (4,378 bytes, 218 call sites). `008f20ad`, the validated stat_mental reference, still has no containing function in the partial database; no entry was invented. These are partial static database facts, not complete engine coverage.

The function at `008e46b0` contains token-reading calls and packed output fields near the stat_pri projectile diagnostic: it is a parsing/validation lead. `00ddf050` gates string construction and helper calls on global initialization bits around ai.battlefield.pathfinding; this supports an initialization/registration interpretation, not a recovered pathfinding algorithm. The larger pathfinding-labelled function remains unclassified. Private pseudocode and call-site lists are retained in `work/medieval2/native-battle-boundary.json`, outside this repository. Native gameplay was not executed or compared.
