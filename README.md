# StudySpot Map

An Android study-spot app centered on Batangas State University – The National Engineering University, Alangilan. React provides the interface, Capacitor packages it as an Android app, Java 21 / Spring Boot provides the REST API, and Supabase PostgreSQL stores spots, ratings, reviews, reports, and map pins.

## Features

- Leaflet and OpenStreetMap campus map with no map API key.
- Add spots, pin locations, rate six criteria, write reviews, report issues, and bookmark spots.
- Navigation stays inside StudySpot. Open a pinned spot, tap **Navigate here**, then **Use GPS & route** or **Choose start on map**. The app draws a walking route, estimates walking time, and provides a scrollable directions list. **Start live guidance** follows foreground GPS; **Pause guidance**, closing navigation, or hiding the app stops the watch. **Recalculate** explicitly requests a new route. Routes follow mapped paths and can stop short of an indoor destination; the app displays the remaining gap.
- Opening and closing times use a compact popup with a scrollable list capped at 220px (about five choices).
- Tap **Use my location** for a GPS snapshot, a map marker, and straight-line distances to pinned spots. Tap **Refresh my location** after moving.
- GPS uses the free Capacitor Geolocation plugin and the device's location service. Distances are calculated on the device with the Haversine formula; they are not walking routes or travel times.
- GPS is requested on tap. Normal GPS distance snapshots expire after five minutes. Live navigation watches run only while its screen is active and visible. Position is not saved to Java or Supabase. Map tiles load for the visible area; routing sends coordinates as described below.
- Demo mode starts empty and resets changes on reload. Live records persist in Supabase.

## Requirements

- Node.js 22.12+ and npm
- Java JDK 21 and Maven 3.9+
- Android Studio with Android SDK 36 for an APK build
- A configured Supabase database for live mode; demo mode needs no database

## Run the browser demo

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173/?demo. Browser location requires permission and HTTPS or localhost. An ordinary HTTP LAN address does not support browser GPS; use the Android APK on a phone. Internet access is needed for map tiles.

## Run the Java backend

The database schema scripts are in `supabase/`. For a **new database**, run `setup.sql` and then `add-map-coordinates.sql` once using the Supabase SQL Editor. These scripts are already applied to the original project's database; do not rerun them there. Set a password for the dedicated `studyspot_api` database login privately in Supabase. No database password or API secret is included in this repository.

Build the backend:

```powershell
cd backend
mvn package
cd ..
./start-backend.ps1 -DbHost 'YOUR-DATABASE-HOST' -DbUser 'YOUR-DATABASE-USERNAME'
```

The script prompts for the database password without displaying it. It defaults to the original project's public database hostname and `studyspot_api` username. For a Session pooler, pass its hostname, port, and the `studyspot_api.PROJECT_REF` username using `-DbHost`, `-DbPort`, and `-DbUser`. Use the connection settings from your project's dashboard. The bundled public CA certificate is used for TLS certificate verification; use `-CertificatePath` if your project requires a different CA.

For local browser live mode, keep Java on port 8080, run the frontend, and open http://localhost:5173 without `?demo`. Vite proxies `/api` to Java on port 8080.

For Android testing, start Java on your local network:

```powershell
./start-backend.ps1 -LocalNetwork -Port 8081
```

Keep the PC and phone on the same Wi-Fi. Enter `http://YOUR-PC-WIFI-IP:8081` on the app's Connection screen. Windows may ask whether to allow Java on your private network. The Java server must remain running. `Start-StudySpot.cmd` launches this mode after the backend has been built.

For other hosts, Java also supports `DB_JDBC_URL`, `DB_USER`, `DB_PASSWORD`, and `SERVER_ADDRESS` environment variables. The JDBC URL must use `sslmode=verify-full` and the appropriate `sslrootcert` path. Store credentials in the hosting environment, never in frontend variables.

## Build an Android APK

```powershell
cd frontend
npm ci
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, install the requested SDK, let Gradle sync, and build the debug APK. Alternatively, with JDK 21, `ANDROID_HOME`, and the SDK configured:

```powershell
cd android
./gradlew.bat assembleDebug
```

The output is `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. The debug build allows local HTTP for Wi-Fi testing. For public use, host the Java backend at an HTTPS URL. This prototype uses anonymous submissions; authentication and moderation need to be added before a public deployment.

Location permissions are declared in the Android manifest. Test on a physical phone with Location enabled: allow or deny permission, refresh after moving, and compare distances to a known pin. No background location permission is requested. iOS source is included but has not been built or tested here; run `npx cap sync ios` on a Mac before building with Xcode.

## Tests

```powershell
cd frontend
node --test src/distance.test.js src/navigation.test.js
npm run build
```

Tests cover distance math, invalid coordinates, the dedicated foot-route endpoint, missing routes, maneuver instructions, route progress, and off-route detection. A public-campus route request also succeeded. Test both scrollable time pickers and GPS navigation on a physical Android phone.

## APIs and free services

- [Leaflet](https://leafletjs.com/) renders the map.
- [OpenStreetMap](https://www.openstreetmap.org/copyright) supplies map tiles, subject to its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Attribution remains visible. No bulk/offline downloading is implemented.
- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation) reads device location with permission. No paid routing API is used.
- The free FOSSGIS / OSRM foot service calculates routes without an API key. Pressing a route button sends the start and destination coordinates to that service, which logs requests. Live GPS updates stay in memory until the user explicitly recalculates. Route requests are limited to one every 1.2 seconds per app, with no automatic rerouting or bulk requests. Public service availability is not guaranteed; heavy usage requires arranging hosting. See https://routing.openstreetmap.de/about.html for attribution, privacy, and usage terms.
- The Java backend connects to Supabase through JDBC. Your Supabase plan's quotas still apply.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/spots` | Load spots, ratings, and reports |
| POST | `/api/spots` | Create a spot |
| POST | `/api/spots/{id}/ratings` | Add a rating and review |
| POST | `/api/spots/{id}/reports` | Report an issue |
| PUT | `/api/spots/{id}/location` | Set a spot's map coordinates |

## Push to GitHub

Extract this ZIP, open a terminal **inside the StudySpot-GitHub folder**, and create an empty GitHub repository (without an initial README). Replace `YOUR-USERNAME` below:

```powershell
git init
git add .
git commit -m "Add StudySpot mobile app with GPS and navigation"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/studyspot-map.git
git push -u origin main
```

The `.gitignore` excludes credentials, local settings, signing keys, dependencies, generated assets, and build outputs. The Gradle wrapper JAR and public Supabase CA certificate are included intentionally. Upload a compiled APK separately under GitHub Releases if desired; pushing source to GitHub does not deploy the Java backend.
