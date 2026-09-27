import type * as React from 'react';
import type { HostComponent, ViewProps } from 'react-native';
// These two deep imports are the sanctioned codegen entry points. React Native
// only re-exports them from the package root since 0.80, and this package
// declares a floor of 0.74, so the path form is the portable one.
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';
import type {
  DirectEventHandler,
  Double,
  Float,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

/**
 * The native contract of the VLC player view: every prop the platform view
 * managers read, every event they emit, every command they answer.
 *
 * This file is the single source of truth. The public types in `./types` are
 * derived from it, which is what keeps them from drifting the way the
 * hand-written `index.d.ts` did.
 */

// -- Event payloads ---------------------------------------------------------

/**
 * Represents a track type in playback
 */
export type Track = Readonly<{
  /** Track identification */
  id: Int32;
  /** Track name */
  name: string;
}>;

/**
 * Payload of the events that carry nothing but the view tag
 */
export type SimpleCallbackEventProps = Readonly<{
  /** Playback target */
  target: Int32;
}>;

export type OnPlayingEventProps = Readonly<{
  target: Int32;
  /** Total playback duration */
  duration: Double;
  seekable: boolean;
}>;

export type OnProgressEventProps = Readonly<{
  target: Int32;
  /** Total playback duration */
  duration: Double;
  /** Current playback time */
  currentTime: Double;
  /** Current playback position */
  position: Double;
  /** Remaining time to end playback */
  remainingTime: Double;
}>;

/**
 * Represents a full playback information
 */
export type VideoInfo = Readonly<{
  /** Playback target */
  target: Int32;
  /** Total playback duration */
  duration: Double;
  /** Total playback video size */
  videoSize: Readonly<{ width: Double; height: Double }>;
  // Codegen does not resolve a type alias as an array element type in an event
  // payload, so the Track shape is inlined here. `Track` below is the same shape
  // and exists for the public API.
  /** List of playback audio tracks */
  audioTracks: { id: Int32; name: string }[];
  /** List of playback text tracks */
  textTracks: { id: Int32; name: string }[];
}>;

export type OnSeekEventProps = Readonly<{
  target: Int32;
  currentTime: Double;
  seekTime: Double;
}>;

export type OnRecordingStateEventProps = Readonly<{
  isRecording: boolean;
  recordPath?: string;
}>;

export type OnSnapshotEventProps = Readonly<{
  success: boolean;
  path?: string;
  error?: string;
}>;

/**
 * Android-only aggregate event. Android routes several state transitions through
 * `onVideoStateChange` instead of dedicated events; the payload is whatever
 * `VideoEventEmitter.onVideoStateChange` put into the map.
 */
export type OnVideoStateChangeEventProps = Readonly<{
  type?: string;
}>;

// -- Props ------------------------------------------------------------------

export type NativeSource = Readonly<{
  uri?: string;
  type?: string;
  isNetwork?: boolean;
  autoplay?: boolean;
  initType?: Int32;
  initOptions?: ReadonlyArray<string>;
  mainVer?: Int32;
  patchVer?: Int32;
}>;

export interface NativeProps extends ViewProps {
  source?: NativeSource;
  subtitleUri?: string;

  paused?: WithDefault<boolean, false>;
  muted?: WithDefault<boolean, false>;
  seek?: Float;
  rate?: Float;
  resume?: WithDefault<boolean, true>;
  videoAspectRatio?: string;
  audioTrack?: Int32;
  textTrack?: Int32;
  acceptInvalidCertificates?: WithDefault<boolean, false>;

  /** iOS only; Android reads autoplay from `source.autoplay`. */
  autoplay?: boolean;
  /** iOS only, and currently unread by RCTVLCPlayer.m. */
  snapshotPath?: string;

  /** Android only. */
  repeat?: WithDefault<boolean, false>;
  /** Android only. */
  volume?: WithDefault<Float, 1.0>;
  /** Android only. */
  autoAspectRatio?: WithDefault<boolean, false>;
  /** Android only. */
  progressUpdateInterval?: WithDefault<Float, 0.0>;
  /** Android only. Setting this at all tears the player down. */
  clear?: boolean;

  onVideoLoadStart?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoOpen?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoLoad?: DirectEventHandler<VideoInfo>;
  onVideoProgress?: DirectEventHandler<OnProgressEventProps>;
  onVideoPlaying?: DirectEventHandler<OnPlayingEventProps>;
  onVideoPaused?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoStopped?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoBuffering?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoError?: DirectEventHandler<SimpleCallbackEventProps>;
  /** Android spells it `onVideoEnd`, iOS `onVideoEnded`. Both are declared. */
  onVideoEnd?: DirectEventHandler<SimpleCallbackEventProps>;
  onVideoEnded?: DirectEventHandler<SimpleCallbackEventProps>;
  /** Android only. */
  onVideoSeek?: DirectEventHandler<OnSeekEventProps>;
  /** Android only. */
  onVideoStateChange?: DirectEventHandler<OnVideoStateChangeEventProps>;
  onRecordingState?: DirectEventHandler<OnRecordingStateEventProps>;
  onSnapshot?: DirectEventHandler<OnSnapshotEventProps>;
}

// -- Commands ---------------------------------------------------------------
//
// Naming rule: a command called `setX` collides with a prop called `x`, because
// codegen generates `setX(view, value)` for both and the generated
// VlcPlayerViewManagerInterface then declares the method twice. The commands that
// imperatively drive a prop are therefore named `apply…`.

type ComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  startRecording: (
    viewRef: React.ElementRef<ComponentType>,
    path: string
  ) => void;
  stopRecording: (viewRef: React.ElementRef<ComponentType>) => void;
  stopPlayer: (viewRef: React.ElementRef<ComponentType>) => void;
  snapshot: (viewRef: React.ElementRef<ComponentType>, path: string) => void;
  seek: (viewRef: React.ElementRef<ComponentType>, position: Float) => void;
  applyResume: (
    viewRef: React.ElementRef<ComponentType>,
    isResume: boolean
  ) => void;
  applyPaused: (
    viewRef: React.ElementRef<ComponentType>,
    paused: boolean
  ) => void;
  applyAutoAspectRatio: (
    viewRef: React.ElementRef<ComponentType>,
    isAuto: boolean
  ) => void;
  applyAspectRatio: (
    viewRef: React.ElementRef<ComponentType>,
    ratio: string
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    'startRecording',
    'stopRecording',
    'stopPlayer',
    'snapshot',
    'seek',
    'applyResume',
    'applyPaused',
    'applyAutoAspectRatio',
    'applyAspectRatio',
  ],
});

// `VlcPlayerView` is the Fabric name the Phase 2b/2c adapters will register.
// `paperComponentName` keeps the legacy lookup on the existing view manager
// name, so the Old Architecture keeps resolving the current managers unchanged.
export default codegenNativeComponent<NativeProps>('VlcPlayerView', {
  paperComponentName: 'RCTVLCPlayer',
}) as ComponentType;
