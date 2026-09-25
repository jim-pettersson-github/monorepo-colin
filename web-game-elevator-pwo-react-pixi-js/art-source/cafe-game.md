# Playable café

The approved elevated concept (`cafe-two-floors-v3.png`) is implemented as a two-floor scene. `room-cafe.png` is the clean background plate, edited with the built-in image generation tool; `public/painted/room-cafe.webp` is the local runtime asset (1536 × 1024, WebP quality 92). `scripts/prepare-painted-art.mjs` exports it.

`cafe-art.ts` draws one moving glass cabin, transparent landing doors, controls, lights, and actors independently. `cafe-spatial.ts` projects the shared simulation coordinates onto the two floor planes and staircase. `cafe-interaction.ts` resolves taps from either floor. Existing doorway interlocks, stair timing, passengers, saves and camera gestures are reused.

## Background edit prompt

Turn this APPROVED illustration into a clean gameplay background plate, with absolutely identical camera, framing, pixel positions, architecture, staircase, floors, furniture, warm painted style and lighting. Only remove elements that will be independently animated:
1 Remove Colin entirely from upstairs next to lift and reconstruct unobstructed wood floor/wall behind him.
2 Remove the SINGLE elevator cabin upstairs: its floor, rear handrail, control buttons, walls. Show one continuous empty teal-tinted transparent shaft with vertical guide rails through BOTH floors instead.
3 Remove the MOVING central sliding glass door leaves on BOTH landing door openings, including their central seams, reflections and moving leaf borders. Keep the large fixed bronze outer jambs/headers/sills exactly in position. Each door opening should be visibly an open empty shaft awaiting runtime glass doors.
4 Remove the small E/1 call plates and round white call buttons immediately right of each elevator door; reconstruct matching bronze jamb beneath. They will be drawn separately at runtime.
Keep shaft exterior stationary glass walls, outer bronze structural columns, thin vertical guide rails and landing framing intact. Do not make huge opaque dark rectangles: shaft remains pale translucent teal with architectural depth. Do not add a cabin anywhere. No people. Do not add plants in front of stair foot. Keep KAFÉ, UT and the green stair sign. Do not alter placement of any furniture or stair rails. Same 1536x1024 image.
