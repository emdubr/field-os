# FIELD/OS optimization progress — October 2026

This tracks the attached Master Optimization List. Its recommendations are proposals, not evidence that every listed defect exists. A passing CI run does not certify the app for emergency or backcountry navigation.

## Implemented and automated-tested on main

- L4: skip repeat boot animation; cap initial intro.
- R1/R2: shared runtime scheduler and delegated navigation pre-existed.
- R7 (partial): coalesce expensive GPS UI updates while preserving raw recorder fixes.
- D2: disable decorative overlays under Low Power/Emergency and reduced motion.
- M4/M6 (partial): bounded map track preview and visible-only chart painting.
- S1/S2/S3 (track scope): transactional IndexedDB track migration, bounded append batches, crash journal, backup, restore, export and fallback. Other logs and caches still use localStorage.
- P2/P3: user-approved service worker activation and stable PWA entry point.
- B3 (partial): map and recorder share a native location watch, with power-aware options. iOS may still suspend GPS in the background.
- Q5/Q8 (partial): functional GPS/storage and real Chromium IndexedDB tests, local diagnostic report copy.
- Additional safety: unverified coordinates omitted from manual position marks and check-in payloads; manual recovery snapshots protected from automatic overwrite; newer 3.85 tile retention, camera and map preview improvements retained.

## Current follow-up

- P8: check actual current-app cache files and flag missing external map libraries. Response counts in old caches are not offline proof.
- New preflight fixes: online hint is labeled as an unverified hint, worker must actually control the page, and an offline map pack ID is not enough without a resolved pack.

## Substantial items remaining

1. L1–L3, P1, Q1: bundle/minify/hash assets and self-host map dependencies; test full offline fallback before deleting any existing provider.
2. S1/S4/S6/S8/S11: migrate other large stores, add POI spatial indexing and versioned backups, age out caches, and coordinate multiple tabs.
3. R8/R11/R13, N1–N4/N7: workerized imports, memoized route analytics, abortable bounded retry requests and verified resumable map downloads.
4. M1–M3/M8/M9, B1/B2/B4: benchmark maps, tiles, elevation and mobile battery handling against real lengthy routes.
5. P4–P7, Q2–Q4: offline fallback/navigation preload, iOS icons, WebKit CI, physical iPhone cold-launch tests, performance budgets and static analysis.
6. Safety acceptance: real GNSS loss/recovery, sustained offline travel, storage pressure, dual-tab migrations and Meshtastic/satellite hardware. Never substitute FIELD/OS prototype SOS for certified emergency communication.

This review additionally found potential false readiness from stale cache counts, unregistered service worker detection and stale saved-map IDs. The current follow-up addresses their status reporting, not guaranteed offline functionality.
