# FIELD/OS 3.8

TAP V2 companion interface. GitHub Pages deploys from main / root.

Desktop uses a persistent side menu; phones use bottom tabs. All 16 modules share terminal panels and local app state. Hardware/mesh transport remains unconnected; sensor values marked DEMO are simulated.

## Regression checks

Run with Node.js 22 or later:

```sh
npm install --no-save --package-lock=false jsdom@29
node tests/regression.cjs
```

The tests use an isolated DOM and mocked network responses. They check all 16 module views, four themes, waypoint and trip persistence, direct routing, trail-segment snapping, distance, elevation success/failure, reverse/undo/clear, cancellation, valid GPX import/export, rejected invalid GPX, and startup errors. They never access a live user's saved data or transmit messages.

Browser validation remains necessary for layout, live tile servers, routing/elevation services, and phone permissions. Physical TAP V2, Bluetooth, real GPS/compass, and satellite SOS cannot be validated by these tests.

## Data and offline behavior

Existing fieldos-v12 local-storage keys are preserved. Route changes save locally. Service workers cache the app shell; regional PMTiles are managed separately. Trail routing and elevation lookup require online services. Elevation uses sampled terrain data and is an estimate. Missing elevation is displayed as unavailable; no simulated profile is substituted.

Routing improvements: first-point trail preloading, session cache, cached completed legs, instant local reverse, concurrent backup servers, and nonblocking elevation. Network failures retain the last completed route. First-time routing still depends on public Overpass availability.
