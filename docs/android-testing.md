# StudySpot Android test report

- Test date: 2026-11-18
- Phone model and Android version: Redmi Note 14 Pro, Android 16
- APK version: 1.6.1
- App mode: Demo mode

| Check | What I observed | Pass / Fail / Not tested |
| --- | --- | --- |
| Added a spot and found its marker | Successfully saved a study spot. Its marker appeared on the map and displayed the correct name. | Pass |
| Denied GPS permission | Denied location permission. I could still browse the map without granting GPS permission. | Pass |
| Allowed GPS and checked distance | Allowed location permission. The app successfully displayed a route, but the distance display was not explicitly verified. | Not tested |
| Requested a walking route | Successfully requested a walking route. | Pass |
| Started and paused live guidance | Both Start live guidance and Pause guidance buttons worked successfully. No errors were encountered. | Pass |

## Issues

No major issues encountered during testing.

Note: The distance display was not explicitly verified.
