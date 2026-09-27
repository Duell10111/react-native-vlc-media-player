# Modernisierungsplan: New Architecture, Swift & Wartbarkeit

Bestandsaufnahme vom 2026-09-27, Stand `v1.0.103` (Commit `bae706b`).

Analysiert wurden: JS-Layer (`VLCPlayer.js`, `playerView/`), Android-Java
(`android/src/main/java/com/yuanzhou/vlc/`), iOS-ObjC (`ios/RCTVLCPlayer/`),
`react-native-vlc-media-player.podspec`, `android/build.gradle`, Expo-Plugin
(`expo/`) und die GitHub-Workflows.

## Leitentscheidungen

1. **RN Codegen**, nicht Expo Modules API (Begründung: Abschnitt 5).
2. **Swift** für die iOS-Player-Logik, **Kotlin** für Android. Beides
   verbindlich, aber mit unterschiedlichem Risikoprofil: iOS ist ein Rewrite
   mit Umstrukturierung, Android eine werkzeuggestützte Konversion. Deshalb
   getrennt sequenziert (Phase 2b bzw. 2c).
3. **Old Architecture wird weiter unterstützt** — aber strikt isoliert, sodass
   der Ausbau später ein Löschvorgang ist und kein Umbau (Abschnitt 4).
4. Damit ist der Umbau **kein Breaking Change**: die öffentliche JS-API bleibt
   signaturgleich, nur der Transportweg darunter wechselt. Release als `1.x`
   möglich, Major erst bei Phase 5 (VLCKit 4).

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
- Kein `s.swift_version` (Voraussetzung für Phase 2).

### Kleinere Bugs
- `VLCPlayer.js:160` ruft `this.props.onRecordingCreated(...)` ungeprüft auf →
  Crash, wenn das Prop fehlt.
- Events sind in `RCTVLCPlayer.h` als `RCTBubblingEventBlock` deklariert, im
  Manager aber als `RCTDirectEventBlock` exportiert.

---

## 3. Architekturprinzip: Core + Adapter

Das ist die tragende Entscheidung für alles Weitere. Jede Plattform wird in zwei
Schichten geteilt:

```
JS          VlcPlayerViewNativeComponent.ts   ← eine Spec, arch-agnostisch
                          |
iOS         VlcPlayerView.swift               ← Core: VLC-Logik, kennt RN nicht
            ├── VlcPlayerComponentView.mm     ← Adapter New Arch  (löschbar: nein)
            └── RCTVLCPlayerManager.m         ← Adapter Old Arch  (löschbar: JA)

Android     VlcPlayerView.kt                  ← Core: VLC-Logik
            VlcPlayerViewManager.kt           ← ein Manager für beide
            ├── src/newarch/…ManagerSpec.kt   ← Adapter New Arch  (löschbar: nein)
            └── src/oldarch/…ManagerSpec.kt   ← Adapter Old Arch  (löschbar: JA)
```

**Die eiserne Regel:** Architektur-Unterscheidungen existieren nur als
*ganze Dateien*. Kein `#ifdef RCT_NEW_ARCH_ENABLED` innerhalb der Swift- oder
Kotlin-Core-Dateien, keine `if (isFabric)`-Zweige in der Logik. Ein `#if
os(tvOS)` im Swift-Core ist erlaubt — das ist Plattform, nicht Architektur.

Drei Dinge sind erfreulicherweise **von sich aus arch-agnostisch** und brauchen
gar keinen Adapter:

- **Der JS-Layer.** `codegenNativeComponent` fällt auf Old Arch automatisch auf
  `requireNativeComponent` zurück, `codegenNativeCommands` dispatcht dort über
  den UIManager. Eine Spec, beide Architekturen, keine Verzweigung.
- **Android-Events.** `UIManagerHelper.getEventDispatcherForReactTag()` mit
  einer eigenen `Event`-Subklasse funktioniert auf beiden Architekturen. Das
  ersetzt `VideoEventEmitter` ersatzlos.
- **Die Player-Logik selbst.** Swift/Kotlin-Core sieht von React nur die
  View-Basisklasse.

Damit reduziert sich die Dual-Arch-Last auf rund 160 Zeilen Adapter-Code.

---

## 4. Umbauplan

Die Reihenfolge ist wesentlich: Ohne Phase 0 und 1 migriert man Phase 2 blind.

### Phase 0 — Fundament (kein Breaking Change, ~1 Tag)

Ziel: Änderungen überhaupt überprüfbar machen.

- [x] Publish-Pipeline entschärfen: Release über Tag oder `workflow_dispatch`
      statt Auto-Patch-on-Push, mit vorgeschaltetem Build-/Lint-Job.
      → `ci.yml` (auch als `workflow_call` wiederverwendbar) + `release.yml`;
      `npmpublish.yml` und `npmpublish-beta.yml` entfallen.
- [x] `files`-Whitelist in `package.json`. → Tarball von 44 auf 29 Dateien.
- [x] `peerDependencies` für `react` und `react-native` ergänzen.
      → `react >=18.2.0`, `react-native >=0.74.0` (Begründung: Phase 1).
- [x] Podspec-Version aus `package.json` lesen
      (`JSON.parse(File.read("package.json"))`).
- [x] VLC-Version an *einer* Stelle definieren (Podspec, Expo-Plugin, Gradle).
      → Feld `vlc: { ios, android }` in `package.json`; Podspec, Expo-Plugin und
      `android/build.gradle` (via `JsonSlurper`) lesen es. iOS ist damit einheitlich
      auf `3.5.1` — der Expo-Plugin-Pin `3.3.10` hat vorher mit dem Podspec
      kollidiert.
- [x] `.idea/` und `ios/**/xcuserdata` aus dem Repo entfernen, `.gitignore`
      ergänzen. → zusätzlich `android/react-native-yz-vlcplayer.iml`.
- [x] `onRecordingCreated`-Guard und `Bubbling`/`Direct`-Inkonsistenz fixen.
      → `RCTVLCPlayer.h` auf `RCTDirectEventBlock`, passend zum Manager.
- [x] *Zusätzlich:* `react-native-slider` aus `dependencies` entfernt. Der Import
      in `ControlBtn.js` ist auskommentiert — das Paket wurde von jedem Konsumenten
      mitgezogen, ohne je geladen zu werden.

### Phase 1 — Repo-Struktur, TypeScript, Test-Matrix

Ziel: Standard-Layout, generierte Typen, lauffähige Beispiel-App.

- [x] Auf das Layout von `create-react-native-library` ziehen.
      → `src/`, `example/`, npm-Workspace. Die Example-App verlinkt die Library
      über `file:..`; `"*"` reicht nicht, weil das Root-Package selbst kein
      Workspace-Eintrag ist und npm sonst 1.0.98 aus der Registry zieht.
- [x] `src/` in TypeScript, Build via `react-native-builder-bob`
      (commonjs / module / typescript).
      → Kein `exports`-Feld: bob's Non-ESM-Dual-Output ist CJS/ESM-ambivalentes
      `.js`, und eine `exports`-Map würde die Deep-Imports verbieten, die vorher
      funktionierten.
- [x] ESLint + Prettier + `tsconfig.json`.
      → ESLint 10 Flat Config mit `typescript-eslint` und
      `eslint-plugin-react-hooks` 7. `eslint-plugin-react` deklariert ESLint 10
      nicht und würde `npm ci` an einem Peer-Konflikt scheitern lassen.
      `tsconfig` mit `strict`, `noUnusedLocals`, `noUnusedParameters`.
- [x] **`example/`-App mit Expo-Prebuild.** Wichtigster Einzelschritt für
      Review-Fähigkeit. → Expo SDK 54 / RN 0.81.6. `EXAMPLE_ARCH=old` schaltet
      über `app.config.js` auf die Old Architecture um. Die App bedient die
      gesamte imperative API (Seek, Snapshot, Recording, Aspect Ratio) und zeigt
      an, auf welcher Architektur sie läuft.
- [x] **CI-Matrix über vier Konfigurationen:** iOS und Android, jeweils Old und
      New Arch. Solange Old Arch supported ist, ist das die einzige Absicherung
      gegen stille Regressionen.
- [x] `index.d.ts` löschen — wird generiert.
- [x] Klassen-Component → Function-Component mit `forwardRef` +
      `useImperativeHandle`; `prop-types` entfernen. → `prop-types` stand
      ohnehin in keiner `dependencies`-Liste und wurde transitiv über RN
      aufgelöst.
- [x] `resolveAssetSource`-Deep-Import auf `Image.resolveAssetSource` umstellen.
- [x] RN-Mindestversion festlegen und **in der Matrix verifizieren** — die
      benutzten Codegen-Features (`codegenNativeCommands`, Old-Arch-Fallback)
      bestimmen die Untergrenze, nicht die Wunschvorstellung.
      → **`>=0.74.0`**, Matrix verifiziert `0.81.6`. Siehe den Kasten unten:
      oberhalb von 0.81 *kann* die Old Arch nicht mehr verifiziert werden.

#### Der Deckel auf der Old Architecture

**RN 0.82 hat die Old Architecture entfernt.** `newArchEnabled=false` und
`RCT_NEW_ARCH_ENABLED=0` werden dort ignoriert. RN 0.81 / Expo SDK 54 sind die
letzten Versionen, in denen die vier Konfigurationen überhaupt existieren.

Das hat zwei Konsequenzen für den Restplan:

1. Die Example-App ist auf RN 0.81 festgenagelt, solange die Matrix vier Jobs
   hat. Ein Update auf 0.82+ ist damit gleichbedeutend mit Phase 3.
2. Phase 3 ist kein „irgendwann" mehr, sondern hat einen Auslöser: sobald die
   RN-0.81-Reihe kein Sicherheitssupport mehr bekommt, wird das Festhalten an
   der Old Arch zum Blocker für die eigene CI.

#### Vorgezogen aus Phase 2b/2d

Ohne diese Punkte baut die Example-App nicht, und ohne baubare App ist Phase 1
wirkungslos. Bewusst nur das Minimum:

- [x] `android/build.gradle`: `buildscript`-Block mit AGP 4.0.2 entfernt,
      `com.facebook.react:react-native:+` → `apply plugin: 'com.facebook.react'`
      + `com.facebook.react:react-android`, wirkungsloses mvnrepository-Repo
      entfernt, `compileOptions` auf Java 17, `compileSdk`/`minSdk` statt der in
      AGP 9 entfallenden `*Version`-Varianten.
- [x] Podspec: `install_modules_dependencies(s)` statt `s.dependency 'React'`
      (definiert `RCT_NEW_ARCH_ENABLED`), `deployment_target` 8.4/10.2 → 13.4.
      13.4 ist das Minimum von RN 0.74 und damit passend zur deklarierten
      Untergrenze; Phase 2b hebt zusammen mit Swift auf 15.1.
- [x] Expo-Plugin `withGradleTasks`: Der Anker
      `applyNativeModulesAppBuildGradle(project)` existiert in RN-≥0.71- und
      Expo-Templates nicht mehr — `expo prebuild` **crashte** daran. Jetzt
      `apply plugin: "com.facebook.react"`. Zusätzlich ist die
      `libc++_shared.so`-Bereinigung null-safe: vorher lief sie bei nicht
      gefundenem Verzeichnis in eine NPE mitten im Build.

Noch offen und bewusst bei Phase 2d gelassen: Gradle Wrapper 6.9,
`androidx.legacy:legacy-support-v4`.

#### Verhaltensänderungen in Phase 1

Der Umbau ist signaturgleich, aber an vier Stellen ist altes Verhalten
nachweisbar falsch und wurde mit korrigiert:

1. `source` wird nicht mehr mutiert. `resolveAssetSource` gibt Objekt-Quellen
   unverändert zurück, der Player schrieb also `isNetwork`, `autoplay` und
   `--repeat` in das Objekt des Aufrufers.
2. `TimeLimit` renderte auskommentierte Zeilen als JSX-Textkinder (`//`) direkt
   in einer `TouchableOpacity` — „Text strings must be rendered within a
   `<Text>`". Jeder, der die Werbevorlauf-Funktion (`isGG`) benutzte, bekam einen
   Crash.
3. `VLCPlayerView.componentWillUnmount` rief `_onStopped()`, was das `onStopped`-
   Prop (also `onEnded`) während des Unmounts feuerte und darin `setState`
   aufrief. Jetzt wird nur noch die native View pausiert.
4. `SizeController.getChangeRatio()` gab auf den meisten Geräten einen String
   (`"1.33"`) und auf manchen die Zahl `1` zurück. Jetzt durchgängig `number`.

Nicht mitkorrigiert, weil es sichtbares Verhalten ändern würde:
`Orientation.lockToPortrait` / `lockToLandscape` in `playerView/index.tsx` sind
im Original hängende Ausdrücke ohne Aufruf. Die Stellen sind kommentiert und
gehören zu Phase 4.

Die einzige echte Bruchstelle ist der **Deep Import**: `…/VLCPlayer` und
`…/playerView/…` liegen jetzt unter `lib/`. Dokumentiert war nur
`import { VLCPlayer, VlCPlayerView } from 'react-native-vlc-media-player'`, und
das ist unverändert; ein `exports`-Feld wurde gerade deshalb *nicht* eingeführt.
Gehört in die Release Notes.

#### Was der erste echte Build zutage gebracht hat

Beides war vorher nicht sichtbar, weil nichts gebaut wurde:

- **`minSdk 26` gegen Template-Default 24.** Der Manifest-Merger bricht mit
  `minSdkVersion 24 cannot be smaller than version 26` ab. Das trifft jeden
  Expo-Nutzer. Im README dokumentiert, in der Example-App über
  `expo-build-properties` gesetzt.
- **Die Old-Arch-iOS-Konfiguration baut React Native aus dem Quellcode.** Expo
  setzt `RCT_USE_PREBUILT_RNCORE`/`RCT_USE_RN_DEP` nur, wenn
  `newArchEnabled != 'false'`. Folge: `Pods/fmt` 11.0.2 wird mitkompiliert und
  scheitert am clang aus Xcode 26+ (`call to consteval function … is not a
  constant expression`). Der CI-Job pinnt daher Xcode 16.4. Lokal auf macOS 26+
  ist diese eine Konfiguration nicht baubar — zusätzlich bricht dort Apples
  `openrsync` die CocoaPods-Phase `[CP] Copy XCFrameworks` von MobileVLCKit.
  Verifiziert wurden lokal drei der vier Konfigurationen; die vierte hängt an
  diesen beiden Toolchain-Punkten, nicht an diesem Repo.
- **`install_modules_dependencies` setzt `-DRCT_NEW_ARCH_ENABLED=1` nur in
  `OTHER_CPLUSPLUSFLAGS` und `OTHER_SWIFT_FLAGS`**, nicht in
  `GCC_PREPROCESSOR_DEFINITIONS`. Für reine `.m`-Dateien ist das Makro also nicht
  definiert. Der `#ifndef RCT_NEW_ARCH_ENABLED`-Guard um `RCTVLCPlayerManager.m`
  aus Phase 2b greift so nicht — die Datei muss `.mm` werden oder der Guard
  anders gezogen werden.

### Phase 2a — JS-Spec (arch-agnostisch)

- [ ] `src/VlcPlayerViewNativeComponent.ts` mit `codegenNativeComponent`,
      Events als `DirectEventHandler<…>`.
- [ ] Commands via `codegenNativeCommands`: `startRecording`, `stopRecording`,
      `stopPlayer`, `snapshot`, **`seek`**, `setResume`, `setAspectRatio`.
- [ ] Die `setNativeProps`-Aufrufe in echte Props bzw. Commands überführen.
      Öffentliche Methodensignaturen bleiben unverändert — der Umbau ist für
      Konsumenten unsichtbar.

### Phase 2b — iOS auf Swift

- [ ] **Core:** `ios/VlcPlayerView.swift` — `UIView`-Subklasse mit der Logik aus
      den 544 Zeilen `RCTVLCPlayer.m`. VLCKit-Import via `import MobileVLCKit`
      bzw. `import TVVLCKit` unter `#if os(tvOS)`.
- [ ] Events als `@objc`-kompatible Closures am Core
      (`var onProgress: ((NSDictionary) -> Void)?`) — keine React-Typen im Core.
- [ ] **Adapter New Arch:** `ios/VlcPlayerComponentView.mm`, Subklasse von
      `RCTViewComponentView`. Muss ObjC++ sein (C++-Props-Typen aus Codegen),
      hält die Swift-View und übersetzt `updateProps:` und `handleCommand:args:`.
- [ ] **Adapter Old Arch:** `ios/RCTVLCPlayerManager.m` bleibt, aber reduziert
      auf `RCTViewManager` + `RCT_EXPORT_VIEW_PROPERTY`; die vier
      `RCT_EXPORT_METHOD`/`uiManager`-Blöcke entfallen (Commands laufen jetzt
      über die Spec). Ganze Datei in `#ifndef RCT_NEW_ARCH_ENABLED`.
- [ ] **Podspec:** `install_modules_dependencies(s)` (definiert
      `RCT_NEW_ARCH_ENABLED`), `s.swift_version`,
      `s.ios.deployment_target = "15.1"`, `static_framework` beibehalten.
- [ ] **Papercut einplanen:** die ObjC++-Adapter brauchen den generierten
      Swift-Header (`#import "react_native_vlc_media_player-Swift.h"`, Name =
      Modulname mit Unterstrichen). Das ist die häufigste Fehlerquelle beim
      ObjC↔Swift-Mix in Pods — früh gegen die Beispiel-App verifizieren, auch
      für tvOS.

### Phase 2c — Android auf Kotlin

**Vor** dem Adapter-Umbau und als eigener PR. Eine 983-Zeilen-Sprachkonversion
mit einem Event-Dispatch-Rework im selben Diff zu vermischen macht das Bisecten
einer Regression unzumutbar. Diese Phase ist rein verhaltenserhaltend und gegen
die Beispiel-App aus Phase 1 verifizierbar.

- [ ] Kotlin-Plugin in `android/build.gradle`:
      `apply plugin: 'org.jetbrains.kotlin.android'`.
- [ ] **Kotlin-Version nicht hart pinnen.** Eine Library, die ihre eigene
      Version festnagelt, kollidiert mit der der App. Übliches Muster:
      `rootProject.ext.has("kotlinVersion") ? rootProject.ext.get("kotlinVersion") : "<fallback>"`.
      RN selbst konfiguriert Kotlin bereits, das Risiko für Konsumenten ist
      dadurch gering.
- [ ] `jvmTarget` und `compileOptions` auf denselben Wert (17 bei aktueller AGP).
- [ ] Kein explizites `implementation kotlin-stdlib` mit fixer Version — kommt
      über das Plugin.
- [ ] `ReactVlcPlayerView.java` (983 Zeilen) → `VlcPlayerView.kt`. Konverter der
      IDE als Ausgangspunkt, danach Handarbeit.
- [ ] `ReactVlcPlayerViewManager.java` und `VideoEventEmitter.java` mitkonvertieren.
- [ ] **Nullability ernst nehmen.** Der Java-Code nutzt `@Nullable` inkonsistent;
      die Konversion legt echte NPE-Risiken in den VLC-Event-Callbacks offen. Das
      ist der eigentliche Gewinn der Phase — die Fundstellen nicht mit `!!`
      zudecken.
- [ ] Verifizieren: Beispiel-App auf Old *und* New Arch, bevor Phase 2d beginnt.

### Phase 2d — Android: Adapter & Gradle

- [ ] `VideoEventEmitter` auf `UIManagerHelper.getEventDispatcherForReactTag()`
      + eigene `Event`-Subklasse umstellen. Arch-agnostisch, kein Adapter.
- [ ] `receiveCommand` auf die String-Signatur.
- [ ] **Adapter:** `android/src/newarch/` und `android/src/oldarch/` mit je einer
      `VlcPlayerViewManagerSpec.kt`-Basisklasse (~20 Zeilen); Auswahl über
      `sourceSets` anhand des `newArchEnabled`-Flags. Der echte
      `VlcPlayerViewManager` erbt davon und existiert nur einmal.
- [ ] Gradle modernisieren: RN-Gradle-Plugin, `react-android` statt
      `react-native:+`, AGP/Wrapper aktuell, `legacy-support-v4` und das
      wirkungslose mvnrepository-Repo entfernen.

### Phase 3 — Ausbau der Old Architecture (später, als Checkliste)

Wenn die Zeit reif ist, ist das ein reiner Löschvorgang. Diese Liste ist der
eigentliche Zweck von Abschnitt 3 — sie muss bei jeder Änderung gültig bleiben:

- [ ] `ios/RCTVLCPlayerManager.m` + `.h` löschen.
- [ ] `#ifdef RCT_NEW_ARCH_ENABLED`-Guard in `VlcPlayerComponentView.mm`
      entfernen (Datei bleibt).
- [ ] `android/src/oldarch/` löschen.
- [ ] `sourceSets`-Block aus `android/build.gradle` entfernen, Inhalt von
      `src/newarch/` nach `src/main/` verschieben.
- [ ] CI-Matrix von vier auf zwei Konfigurationen reduzieren.
- [ ] RN-Mindestversion auf 0.76+ anheben, Major-Release.

**Akzeptanzkriterium für Phase 2:** Diese Liste enthält keinen Schritt, der eine
Datei *ändern* statt löschen muss — außer dem Entfernen von Guards. Sobald ein
Punkt „Logik X umschreiben" lauten würde, ist die Isolation verletzt.

### Phase 4 — `playerView` ausgliedern

Ziel: dependency-freier Kern-Player.

Das Control-UI (`playerView/`, 6 Dateien) ist der Grund für Slider und
Vector-Icons und für einen guten Teil der Issues.

- [ ] Entweder eigener Export-Pfad mit `peerDependenciesMeta.optional`,
- [ ] oder Auslagerung in ein separates Package.

### Phase 5 — VLC aktualisieren (Major)

- [ ] iOS/tvOS: `MobileVLCKit`/`TVVLCKit` 3.5.1 → `VLCKit` 4.x (ein XCFramework
      für beide Plattformen).
- [ ] Android: `libvlc-all` 3.6.3 → 4.x, sobald stabil.

**Achtung:** VLCKit 4 bricht die Track-API — `audioTrack`/`textTrack` sind dort
String-Identifier statt `int`. Das ist der Breaking Change an der JS-Oberfläche
und rechtfertigt die Major-Version; Phase 2 tut das nicht.

---

## 5. Verworfene Alternative: Expo Modules API

Die Frage kommt garantiert wieder, daher dokumentiert.

Nicht zu verwechseln mit dem **Config-Plugin** in `expo/` + `app.plugin.js`, das
bereits existiert und Podfile/Gradle patcht. Das ist orthogonal und bleibt.

Non-Expo-Nutzer wären **nicht** ausgeschlossen — `expo-modules-core` läuft in
Bare-RN-Apps (`npx install-expo-modules`). Gegen den Wechsel sprechen vier
Punkte:

1. **Harte Dependency für die gesamte Install-Base**, inklusive Eingriff in
   `MainApplication`/`AppDelegate`. Wer den Schritt vergisst, bekommt Fehler, die
   er nicht zuordnen kann → Support-Last.
2. **Keine generierten TypeScript-Typen.** Expo Modules löst das
   `index.d.ts`-Drift-Problem aus Abschnitt 2 *nicht*. Codegen dreht die
   Richtung: die TS-Spec ist die Quelle, das Native muss sich fügen, sonst
   kompiliert es nicht.
3. **tvOS** ist über `react-native-tvos` möglich, aber deutlich weniger
   ausgetreten als der Codegen-Pfad. Das Package unterstützt tvOS heute.
4. **Rewrite-Umfang.** Expo-Views müssen von `ExpoView` erben, d.h. beide
   Plattform-Cores (~1500 Zeilen fragile Player-Logik) werden angefasst. Der
   Codegen-Plan tauscht nur die Randschicht.

Der stärkste Punkt *für* Expo Modules war „ein Code-Pfad für beide
Architekturen ohne `#ifdef`". Mit dem Core-Adapter-Zuschnitt aus Abschnitt 3
kostet Dual-Arch hier rund 160 Zeilen Adapter — weniger als Punkt 1 wert ist.
Der Vorteil von Swift und weniger Boilerplate bleibt bestehen, wird aber durch
Phase 2b ohnehin größtenteils eingelöst.

**Neu bewerten, wenn:** tvOS-Support aufgegeben wird *und* der Core ohnehin nach
Kotlin/Swift konvertiert ist. Dann schrumpft Punkt 3 und 4 auf null und die
Rechnung kippt.
