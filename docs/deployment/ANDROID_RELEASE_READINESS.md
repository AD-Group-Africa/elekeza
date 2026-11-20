# ANDROID RELEASE READINESS — 2026-11-20

**Verdict: NOT RELEASE READY.** No current APK exists, no release signing configuration exists, and the
wrapper cannot render anything without a hosted URL. Nothing here was tested on a physical device.

---

## 1. What the Android app actually is

**[O] It is a Capacitor WebView shell around the hosted Next.js PWA. It is not a native Kotlin/Java
application, and must not be described as one.**

Evidence:

| Fact | Source |
|---|---|
| `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` = **^8.4.1** | `frontend/package.json` |
| `appId: com.elekeza.app`, `appName: Elekeza`, `webDir: 'out'` | `frontend/capacitor.config.ts` |
| `MainActivity.java` — stock `BridgeActivity`, no custom Kotlin/Java logic | `frontend/android/app/src/main/java/com/elekeza/app/MainActivity.java` |
| The only first-party code in the shell is the Capacitor bridge | same |

The shell is ~4 MB of WebView container plus a splash screen. All product behaviour comes from the web app.

---

## 2. Verified configuration

| Item | Value | Assessment |
|---|---|---|
| `applicationId` | `com.elekeza.app` | OK; **must not change after first store upload** (it is the permanent identity) |
| `versionCode` / `versionName` | `1` / `"1.0"` | Placeholder. Must be bumped per upload; Play rejects a reused code |
| `minSdkVersion` | **24** (Android 7.0) | Reasonable for Kenyan school devices |
| `targetSdkVersion` / `compileSdk` | **36** | Current; satisfies Play's target-API requirement |
| Permissions | `INTERNET` only | **Good** — no camera/location/contacts/storage requests |
| Cleartext traffic | not enabled; `server.cleartext: false` | **Good** — TLS-only, and targetSdk ≥ 28 blocks cleartext by default |
| `allowBackup` | was `true` → **changed to `false` this session** | Was a real risk: a device/cloud backup could extract the WebView cookie store for a minor's authenticated session |
| FileProvider | declared, `exported=false`, scoped paths | OK |
| WebView debugging | not enabled (no `setWebContentsDebuggingEnabled`) | OK for release |
| Network security config | not present | Acceptable given cleartext is off by default; add one if a school network needs a pinned proxy |
| Signing key | `frontend/android/elekeza.keystore` exists **locally**, untracked, `*.keystore` ignored at `.gitignore:34`, **absent from all git history** | **Good** — but it exists on exactly one machine with no backup, no documented alias, and no password in any secret manager |

## 3. What is missing for a release build

| # | Gap | Detail |
|---|---|---|
| 1 | **No `signingConfig`** | `app/build.gradle` declares none, so a `release` build is unsigned and cannot be installed or uploaded |
| 2 | **No local web bundle** | `webDir: 'out'`, but `next.config.ts` has no `output: 'export'` and `frontend/out/` does not exist. The app therefore has **nothing to load offline** — it can only work with `CAPACITOR_SERVER_URL` pointing at a hosted frontend |
| 3 | **No current APK** | Debug APK dated **2026-07-17**, "release" APK dated **2026-07-30**, both predating `baed7f4` by ~4 months. Neither is evidence about the current code |
| 4 | **No device test** | Not run on any physical Android device in this session |
| 5 | **Keystore custody** | Single copy on one workstation; loss means the app can never be updated under the same identity |
| 6 | **No CI build** | `.github/workflows/ci.yml` builds backend/AI/frontend; no Android job |

## 4. Why the APK cannot be built yet (dependency, not choice)

`CAPACITOR_SERVER_URL` must be the **staging** frontend origin. Staging does not exist
(see `STAGING_DEPLOYMENT_REPORT_2026-11-20.md`). Building an APK now would either point at production —
prohibited — or at localhost, which is useless on a device.

Correct order: staging deployed and health-checked → `CAPACITOR_SERVER_URL=https://<staging> npx cap sync android`
→ build → test on a device.

## 5. Release procedure (when staging exists)

```bash
cd frontend
CAPACITOR_SERVER_URL=https://<staging-frontend> npx cap sync android

cd android
# 1. add a signingConfig reading from a secret file that is NOT committed:
#    signingConfigs { release { storeFile file(System.getenv("ELEKEZA_KEYSTORE"))
#                               storePassword System.getenv("ELEKEZA_STORE_PASSWORD")
#                               keyAlias System.getenv("ELEKEZA_KEY_ALIAS")
#                               keyPassword System.getenv("ELEKEZA_KEY_PASSWORD") } }
./gradlew assembleRelease        # after the signingConfig exists
```

Then, on a real device: install, sign in, confirm the session survives app restart and backgrounding, confirm
the app opens the **staging** origin, confirm it fails safely with a clear message when offline, and confirm a
signed-out user cannot reach a cached authenticated page.

## 6. Offline behaviour — honest statement

Because there is no bundled web asset (`webDir` is empty of build output), **offline the app shows the
WebView's network-error page, not the Elekeza PWA offline experience.** The PWA service worker caches lessons
for the *browser*; that cache is not automatically what the WebView shell uses.

**[R]** Two options for the pilot, in order of cost:

1. **Accept a "school Wi-Fi required" APK** — state it plainly in the pilot pack. Cheapest, honest.
2. **True offline shell** — add `output: 'export'` to a dedicated Capacitor build config, sync `out/`, and
   accept that App-Router server features (dynamic routes, rewrites) do not exist in a static export. This is
   real work, not a switch.

## 7. Recommendation

| Use | Ready? |
|---|---|
| Demo the PWA in a mobile browser | **Yes** — the web app is responsive and tested at mobile viewport in E2E |
| Distribute an APK to pilot schools | **No** — signing, current build and device test all missing |
| Claim "native Android app" in AT4D materials | **No** — it is a WebView wrapper; say so |

**Android is a post-pilot workstream unless a pilot school explicitly requires an installed app.** Nothing in
the five-role acceptance depends on it.
