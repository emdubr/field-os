# FIELD/OS 3.61

TAP V2 companion interface. GitHub Pages deploys from main / root.

Desktop uses a persistent side menu; phones use bottom tabs. All 16 modules share terminal panels and local app state. Hardware/mesh transport remains unconnected; sensor values marked DEMO are simulated.

## Regression checks

Run with Node.js 22 or later:

```sh
npm install
npm test
```

The tests use an isolated DOM and mocked network responses. They check all 16 module views, four themes, waypoint and trip persistence, direct routing, trail-segment snapping, distance, elevation success/failure, reverse/undo/clear, cancellation, valid GPX import/export, rejected invalid GPX, and startup errors. They never access a live user's saved data or transmit messages.

Browser validation remains necessary for layout, live tile servers, routing/elevation services, and phone permissions. Physical TAP V2, Bluetooth, real GPS/compass, and satellite SOS cannot be validated by these tests.

## Data and offline behavior

Existing fieldos-v12 local-storage keys are preserved. Route changes save locally. Service workers cache the app shell; regional PMTiles are managed separately. Trail routing and elevation lookup require online services. Elevation uses sampled terrain data and is an estimate. Missing elevation is displayed as unavailable; no simulated profile is substituted.

Routing improvements: first-point trail preloading, session cache, cached completed legs, instant local reverse, concurrent backup servers, and nonblocking elevation. Network failures retain the last completed route. First-time routing still depends on public Overpass availability.

## September 30 QA and feature batch

Added original-list features 30/31 (offline place search and local POI collection),
36 (hiking/street/terrain layer presets), 38 (glove mode), and 39 (one-handed controls).
Search the Map tab using names, categories, or latitude/longitude. Import up to
5,000 points from JSON or GeoJSON; export preserves point names and sources.
System contains persistent touch settings. Presets use the existing map providers.

Fixed sparse-route turn progress, trail cues suppressed by later turns, route-metadata
refresh, hazard crossings between vertices and polygon holes, invalid water positions,
water-query coordinate output and retry controls, expired weather alerts, dependent
weather panels, and IndexedDB completion reporting. Pace learning reuses unchanged
track results; versioned app-shell assets load from the service-worker cache first.

The original feature list is not complete. Junction topology warnings, broader trail-name
continuity, automatic corridor map downloads, and native Apple features remain pending.
Existing PMTiles import/activation and red theme were already present. Offline POI
search does not download map imagery or make online routing work offline.

Validation: full DOM regression/stress suite and service-worker tests pass. Chromium
checks covered Home, Map, Navigation, Route, Weather, and System at 320, 390, 768,
and 1440 pixels, with no horizontal overflow or uncaught page exceptions. POI search,
map centering, persisted imports, and 56-pixel glove controls were exercised.
External network resources were blocked for those browser checks; live providers,
real iPhone/Safari behavior, and physical TAP hardware were not validated.


## Web feature registry through 70

FIELD/OS now treats 70 as the browser/PWA feature target. Historical source comments preserve Features 01–27. The September 30 QA batch separately records original-list 30/31, 36, 38 and 39. Some original labels for 28/29 and 32–37 were not preserved; equivalent capabilities should be tracked by behavior rather than silently inventing old labels.

Features 40–49 are the Browser Field Reliability toolkit: PWA install diagnostics, persistent-storage protection, online/offline state, effective connection type, data-saver awareness, page visibility state, browser battery status when exposed, fullscreen field mode, orientation-lock attempt, Web Share/coordinate copy, and capability audit.

Features 50–59 are the Offline Field Utility console: decimal-to-DMS conversion, point distance/bearing, local scratchpad, timestamped position marks, location card, clipboard location sharing, storage-use meter, offline-readiness scoring, persistent utility state, and route/position-aware refresh.

Features 60–70 are Browser Data Resilience and Preflight: recovery snapshots, snapshot restore, permission audit, service-worker health, Cache Storage health, stale-data watchdog, local diagnostic event log, captured JS/unhandled-promise errors, safe field-UI reset, automatic route-state recovery snapshot, and a consolidated field-launch preflight.

Native Apple-only APIs and physical TAP/Meshtastic transport are intentionally outside this web feature registry and will be handled by the separate Apple version.

## v3.60 desktop UI and refresh fixes

Desktop cards now size to their contents. Map, System, and Route use wider
working columns; elevation occupies a full-width section above route parameters.
Workstation updates are batched once per animation frame, pause when hidden,
and retain unchanged generated content. The schematic caches route geometry and
renders at most 600 display points without changing the route data.
System/runtime labels and app-shell cache versions now agree on v3.60.

Repaired regression checks that previously failed outside their variable scope,
used numeric keys for string-keyed graph nodes, and asserted obsolete versions,
zoom settings, and offline storage keys.

`npm test` runs DOM/route and service-worker checks. `npm run test:desktop`
uses Playwright Chromium (`npx playwright install chromium`) to check all 18
navigation modules at 390, 768, 1024, 1280, 1440, and 1920 pixels, card sizing,
full-width elevation, and stable schematic updates. Both run in GitHub Actions.
Browser checks block external services; they do not validate live map providers
or physical TAP hardware.

## v3.61 workspace search and local-processing improvements

Use **Find a module** in the desktop sidebar or **Ctrl/Cmd+K** to open the offline
workspace switcher. Search module names or task words (GPS, notes, offline maps,
elevation), use Up/Down and Enter to open a result, or Escape to return to the
previous control. Opening Emergency only navigates to its existing screen.

Local place search now retains a sorted index between queries, returns the first
50 matching results, and rebuilds when imported places, waypoints, or cached
water sources change. Typing updates are batched per frame; hidden-page renders
pause. Imports from another tab invalidate the local index.

Storage health scans start when System is first viewed or when explicitly
requested. Concurrent checks share one scan, scoped to FIELD/OS caches.
Timestamp marks preserve latitude/longitude zero, recover malformed saved
records, render labels as text, and report write failures without crashing.

Validation covers the switcher's keyboard/pointer/empty-result/focus behavior,
all 18 modules at six viewport widths, 5,000-place search and invalidation,
malformed mark storage, storage-quota failure, and concurrent cache checks.
