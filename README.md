# FIELD/OS 3.42

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
