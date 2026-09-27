# Modernisierungsplan: New Architecture & Wartbarkeit

Bestandsaufnahme vom 2026-09-27, Stand `v1.0.103` (Commit `bae706b`).

Analysiert wurden: JS-Layer (`VLCPlayer.js`, `playerView/`), Android-Java
(`android/src/main/java/com/yuanzhou/vlc/`), iOS-ObjC (`ios/RCTVLCPlayer/`),
`react-native-vlc-media-player.podspec`, `android/build.gradle`, Expo-Plugin
(`expo/`) und die GitHub-Workflows.

---

## 1. Blocker für die New Architecture

Das sind keine Kosmetikpunkte: Unter Bridgeless/Fabric bricht der Player an
diesen Stellen funktional.

| Stelle | Problem |
| --- | --- |
| `VLCPlayer.js:73-85`, `:129` | `seek()`, `resume()`, `autoAspectRatio()`, `changeVideoAspectRatio()` und `_onStopped()` laufen über `setNativeProps`. Fabric-Komponenten unterstützen das nicht — die gesamte imperative API ist damit tot. |
| `VLCPlayer.js:40-65` | `UIManager.dispatchViewManagerCommand` + `findNodeHandle`; muss auf `codegenNativeCommands` umgestellt werden. |
| `VideoEventEmitter.java:24` | `reactContext.getJSModule(RCTEventEmitter.class)` existiert im Bridgeless-Modus nicht. **Alle** Events brechen. |
| `ReactVlcPlayerViewManager.java:178`, `:187` | `getCommandsMap()` mit int-IDs und `receiveCommand(view, int, args)`. Die int-Variante ist entfernt; New Arch dispatcht String-IDs. |
| `RCTVLCPlayerManager.m:53-97` | `RCT_EXPORT_METHOD` mit `reactTag` + `self.bridge.uiManager.addUIBlock`. `bridge` ist unter Bridgeless nicht verfügbar → Recording, Snapshot und `stopPlayer` brechen auf iOS komplett. |
| `VLCPlayer.js:294` | `requireNativeComponent` ohne Codegen-Spec: keine View-Config, keine Typprüfung. |
| `VLCPlayer.js:7` | Deep-Import von `react-native/Libraries/Image/resolveAssetSource` (private API, verschiebt sich zwischen RN-Versionen). Öffentlich ist `Image.resolveAssetSource`. |

### Die Interop-Layer rettet das nicht

Legacy-ViewManager laufen teilweise über die Native-Interop-Layer weiter, aber
genau die drei hier benutzten Mechanismen — `setNativeProps`,
`uiManager.addUIBlock` und `RCTEventEmitter` — kommen nicht mit. Der direkte Weg
zu Codegen ist deshalb billiger als der Zwischenschritt über Interop.

---

## 2. Wartbarkeits-Schulden

### Prozess
- **Keine Beispiel-App, keine Tests, kein Lint, kein Build.** `npmpublish.yml`
  macht bei jedem Push auf `master` `npm version patch` + `npm publish` — ohne
  einen einzigen Verifikationsschritt. Das erklärt 344 Commits bei Version
  1.0.103. PRs sind praktisch nicht reviewbar, weil sich nichts starten lässt.

### Konsistenz
- `index.d.ts` (7 KB) ist handgepflegt und driftet zwangsläufig von
  `VLCPlayer.js` weg.
- Versionen an drei Stellen uneinheitlich: `podspec:3` sagt `1.0.38`,
  `package.json` sagt `1.0.103`.
- VLC-Version dreifach gepinnt: `3.5.1` im Podspec, `3.3.10` in
  `expo/ios/withMobileVlcKit.js`, `3.6.3` in `android/build.gradle`.

### Package-Metadaten
- `react-native-slider` (seit ~2018 unmaintained/deprecated) und
  `react-native-vector-icons@9` stehen in `dependencies`. Jeder Konsument zieht
  sie mit, obwohl sie nur für das optionale `VlCPlayerView`-Control-UI nötig
  sind.
- `peerDependencies` für `react` / `react-native` fehlen ganz.
- Kein `files`-Feld → `.idea/`, `.github/`, `package-lock.json` und iOS-
  `xcuserdata` landen im npm-Tarball.

### Android-Build
- `buildscript`-Block mit AGP `4.0.2` *innerhalb* der Library
  (`android/build.gradle:21-32`).
- Gradle Wrapper 6.9.
- `com.facebook.react:react-native:+` — Dynamic Version auf ein Artefakt, das
  nicht mehr existiert; heute `react-android` über das RN-Gradle-Plugin.
- `androidx.legacy:legacy-support-v4`.
- Als Maven-Repo ist `https://mvnrepository.com/artifact/org.videolan.android`
  eingetragen. Das ist eine Suchmaschinen-URL, kein Maven-Repo — der Eintrag ist
  wirkungslos.

### iOS-Build
- `s.ios.deployment_target = "8.4"`, `s.tvos.deployment_target = "10.2"`.
- `s.dependency 'React'` statt `install_modules_dependencies(s)`.

### Kleinere Bugs
- `VLCPlayer.js:160` ruft `this.props.onRecordingCreated(...)` ungeprüft auf →
  Crash, wenn das Prop fehlt.
- Events sind in `RCTVLCPlayer.h` als `RCTBubblingEventBlock` deklariert, im
  Manager aber als `RCTDirectEventBlock` exportiert.

---

## 3. Umbauplan

Die Reihenfolge ist wesentlich: Ohne Phase 0 und 1 migriert man Phase 2 blind.

### Phase 0 — Fundament (kein Breaking Change, ~1 Tag)

Ziel: Änderungen überhaupt überprüfbar machen.

- [ ] Publish-Pipeline entschärfen: Release über Tag oder `workflow_dispatch`
      statt Auto-Patch-on-Push, mit vorgeschaltetem Build-/Lint-Job.
- [ ] `files`-Whitelist in `package.json`.
- [ ] `peerDependencies` für `react` und `react-native` ergänzen.
- [ ] Podspec-Version aus `package.json` lesen
      (`JSON.parse(File.read("package.json"))`).
- [ ] VLC-Version an *einer* Stelle definieren (Podspec, Expo-Plugin, Gradle).
- [ ] `.idea/` und `ios/**/xcuserdata` aus dem Repo entfernen, `.gitignore`
      ergänzen.
- [ ] `onRecordingCreated`-Guard und `Bubbling`/`Direct`-Inkonsistenz fixen.

### Phase 1 — Repo-Struktur + TypeScript

Ziel: Standard-Layout, generierte Typen, lauffähige Beispiel-App.

- [ ] Auf das Layout von `create-react-native-library` ziehen.
- [ ] `src/` in TypeScript, Build via `react-native-builder-bob`
      (commonjs / module / typescript).
- [ ] ESLint + Prettier + `tsconfig.json`.
- [ ] **`example/`-App mit Expo-Prebuild**, startbar auf beiden Architekturen.
      Das ist der wichtigste Einzelschritt für Review-Fähigkeit.
- [ ] `index.d.ts` löschen — wird generiert.
- [ ] Klassen-Component → Function-Component mit `forwardRef` +
      `useImperativeHandle`; `prop-types` entfernen.
- [ ] `resolveAssetSource`-Deep-Import auf `Image.resolveAssetSource` umstellen.

### Phase 2 — New Architecture via Codegen

Ziel: Fabric-native Komponente. Das ist der eigentliche Aufwand.

- [ ] Spec `src/VlcPlayerViewNativeComponent.ts` mit `codegenNativeComponent`,
      Events als `DirectEventHandler<…>`.
- [ ] Commands über `codegenNativeCommands`: `startRecording`, `stopRecording`,
      `stopPlayer`, `snapshot`, **`seek`**, `setResume`, `setAspectRatio`. Die
      bisherigen `setNativeProps`-Aufrufe werden damit entweder echte Props oder
      Commands — das ist der API-Umbau.
- [ ] **Android:** `ReactVlcPlayerViewManager` implementiert das generierte
      `…ManagerInterface` + `ViewManagerDelegate`; `receiveCommand` auf die
      String-Signatur.
- [ ] **Android:** `VideoEventEmitter` von `RCTEventEmitter` auf
      `UIManagerHelper.getEventDispatcherForReactTag()` mit eigener
      `Event`-Subklasse. Läuft auf *beiden* Architekturen, also rückwärts-
      kompatibel.
- [ ] **iOS:** `RCTVLCPlayerComponentView` als `RCTViewComponentView`-Subklasse
      (`.mm`), Commands über `handleCommand:args:`. Die vier
      `RCT_EXPORT_METHOD`-Blöcke entfallen.
- [ ] **Podspec:** `install_modules_dependencies(s)`,
      `ios.deployment_target = "15.1"`.
- [ ] RN-Mindestversion auf 0.76+ (New Arch ist dort Default) und als
      `2.0.0` mit klarer Support-Matrix veröffentlichen. Eine ehrliche
      Major-Version ist besser als `#ifdef RCT_NEW_ARCH_ENABLED` in jeder Datei.

Die 983 Zeilen `ReactVlcPlayerView.java` und 544 Zeilen `RCTVLCPlayer.m` bleiben
dabei größtenteils unangetastet — umgebaut wird die Manager- und Emitter-Schicht
darum herum.

### Phase 3 — `playerView` ausgliedern

Ziel: dependency-freier Kern-Player.

Das Control-UI (`playerView/`, 6 Dateien) ist der Grund für Slider und
Vector-Icons und für einen guten Teil der Issues.

- [ ] Entweder eigener Export-Pfad mit `peerDependenciesMeta.optional`,
- [ ] oder Auslagerung in ein separates Package.

### Phase 4 — VLC aktualisieren

- [ ] iOS/tvOS: `MobileVLCKit`/`TVVLCKit` 3.5.1 → `VLCKit` 4.x (ein XCFramework
      für beide Plattformen).
- [ ] Android: `libvlc-all` 3.6.3 → 4.x, sobald stabil.

**Achtung:** VLCKit 4 bricht die Track-API — `audioTrack`/`textTrack` sind dort
String-Identifier statt `int`. Das ist ein Breaking Change an der JS-Oberfläche
und gehört in dieselbe Major-Version wie Phase 2.

---

## 4. Einstiegspunkte

Zwei sinnvolle erste Schritte:

1. **Phase 0 abarbeiten** — kleine, risikolose Commits, macht alles Weitere
   überprüfbar.
2. **Codegen-Spec als Proof of Concept** schreiben, um den Umfang des
   API-Bruchs vorab beurteilen zu können.
