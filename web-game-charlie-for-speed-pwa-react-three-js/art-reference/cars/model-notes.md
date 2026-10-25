# Procedural model reference pass

The 19 PC racer images in `sources.json` guide these local procedural models. Their common body mesh has curved bumper corners, fuller flanks, smooth roof transitions and curved glazing. Headlight panels, bonnet seams and rear lenses follow those surfaces. Angular cars retain their sharper sections. These remain procedural arcade models.

| Car | Details matched to its PC picture |
| --- | --- |
| '98 Indy 500 Pace Car | Open purple C5, gold five-hole wheels and tapered gold bonnet/deck ribbons. |
| Aston Martin DB7 | Swept oval lenses, silver GT body, curved roof and fine multi-spoke wheels. |
| Chevrolet Corvette | Red C5, wider closed pop-up panels, five-spoke wheels and four round rear lights. |
| El Niño | Dark green rounded nose, narrow tall lamp lenses, seven-spoke wheels and no added rear wing. |
| Ferrari 355 F1 Spider | Raised black fabric roof, closed pop-ups, five-spoke wheels and side intake strakes. |
| Ferrari 456 M GT | Silver GT, curved roof and rear window, separate pop-up panels and five-spoke wheels. |
| Ferrari 550 Maranello | Swept three-reflector clusters, curved GT body, five-spoke wheels and side gills. |
| Ford Falcon GT | Four-door window layout, horizontal fluted lamps, five-spoke wheels and rear wing. |
| HSV VT GTS | Four-door cabin, divided front grille, horizontal lamps, five-spoke wheels and rear wing. |
| Italdesign Scighera | Curved canopy, very narrow tall lamp lenses and fine multi-spoke wheels. |
| Jaguar XJR-15 | Small covered lamp clusters, low blue body, five-spoke wheels and rear wing. |
| Jaguar XK8 | Blue GT body, swept oval clusters, curved coupé roof and five-spoke wheels. |
| Jaguar XKR | Red body, shorter raised tan fabric roof, split-spoke wheels and bonnet vents. |
| Lamborghini Countach | Red 25th Anniversary wedge, flared angular arches, divided side glass, side strakes, rear airboxes, deep silver five-hole wheels and a two-support V-shaped wing. |
| Lamborghini Diablo SV | Yellow wedge with fuller rear hips, closed pop-up panels, twin roof scoops, side intakes and SV lettering, dark dished five-hole wheels and a black rear wing. |
| Lister Storm | Long angular GT, horizontal lamps, five-spoke wheels and rear wing. |
| Mercedes-Benz CLK-GTR | Long sculpted silver nose, four separate oval lamps, upper grille and lower opening, red mirrors, curved black splitter, paired-spoke wheels, stacked rear lights and black rear wing. |
| Mercedes-Benz SL600 | White hardtop, horizontal fluted lamps, grille slats and five-hole wheels. |
| Spectre R42 | Closed pop-up panels, rounded red body, gold five-spoke wheels and side intakes. |

Wheel profiles, barrels, dished spokes and brake discs are cached by style and instanced across four wheels. Distant cars keep their own body and roof shapes with simpler wheels. Reference screenshots are not loaded by the game. Car ratings, physics, online normalization and career classes are unchanged.

Run `node scripts/capture-car-lineup.mjs` with the development server running (`CFS_DEV_PORT` selects its port; this review used 4034) to capture every car from the front, side and rear, with headlights both closed and raised. `CFS_CAPTURE_CAR=f550` selects a larger individual view. The capture also records detailed and distant triangle/draw counts in `test-results/car-metrics.json`.

The three favorites have supplementary user references, dedicated detail geometry and recessed cockpits behind tinted glass. See [favorites-notes.md](favorites-notes.md). The other 16 car designs are unchanged by this extra pass.
