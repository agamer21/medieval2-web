# Native investigation — November 6, 2026

REA CLI `inspect-pe-resources` inspected the actual installed PE32 executable without executing it. Evidence `ev_a7bbdd2b7d72fb8073ca3f0a044d89dd6b236ee73ac812302f5bd5eb85e068fc` records 56 resources and five icon groups, with 119 resource-directory entries examined. Non-icon payloads remain opaque; this is resource/identity evidence, not game logic.

The REA Windows Ghidra adapter still rejects x86 targets. A separate existing standalone Ghidra installation was therefore used on a private copy of the executable. This did not alter REA's admission rules or the original game file.

That initial analysis was bounded at 180 seconds and **timed out before completion**. Its discovered function count is not a complete or independently verified engine inventory. The saved private analysis project was then used without another full analysis pass to validate literal-pointer candidates against decoded instruction operands.

Results: 106 raw string candidates concerning morale, fatigue, unit-stat tags and pathfinding; 41 anchors with validated instruction references; four successfully decompiled candidate procedures. The first selected procedures include data initialization/checksum/debug-related code. They do not establish the combat or pathfinding algorithms.

Pseudocode, copied binaries, Ghidra project files and raw evidence remain in the private workspace, outside this repository and website. No native game execution or native-versus-browser gameplay comparison occurred. All conclusions are static and inferred at this stage.

Next: prioritize references to the unit-definition tags, distinguish parsing/state serialization from the actual battle updates, and validate behavior against native reference scenes before claiming implementation parity.
