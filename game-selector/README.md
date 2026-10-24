# Spelhörnan

Static root game selector. Links to colin-elevator/, alfred-fc/, charlie-fs/ and sagospelen/. It never reads or clears game saves. The selector worker caches only its own assets and never handles game paths. Existing saves remain available because every game stays on the same origin.

The root worker replaces the old root elevator worker through the normal update lifecycle; it does not force activation. Already-open elevator sessions can continue until the user requests an update or closes old clients. Legacy ?view=art/depth/cafe links redirect to the relocated elevator game. Installed shortcuts to the old root open the selector after updating.
