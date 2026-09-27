export { default as VLCPlayer } from './VLCPlayer';
export { default as VlCPlayerView } from './playerView';
export { default as BackHandle } from './playerView/BackHandle';

export type {
  BackHandleLike,
  OrientationLike,
  VlCPlayerViewProps,
} from './playerView';
export type { VLCPlayerViewProps } from './playerView/VLCPlayerView';
export type { ControlBtnProps } from './playerView/ControlBtn';
export type { TimeLimitProps } from './playerView/TimeLimit';

export type {
  OnPlayingEventProps,
  OnProgressEventProps,
  OnRecordingStateEventProps,
  OnSeekEventProps,
  OnSnapshotEventProps,
  OnVideoStateChangeEventProps,
  PlaybackMethods,
  PlayerAspectRatio,
  PlayerResizeMode,
  SimpleCallbackEventProps,
  Track,
  VideoInfo,
  VLCPlayerCallbackProps,
  VLCPlayerNativeOnlyProps,
  VLCPlayerProps,
  VLCPlayerSource,
} from './types';

// The native contract, for anyone writing their own view around the native
// component. `NativeProps` is also what Phase 2b/2c generate native code from.
export { Commands as VlcPlayerViewCommands } from './VlcPlayerViewNativeComponent';
export type {
  NativeProps as VlcPlayerViewNativeProps,
  NativeSource as VlcPlayerViewNativeSource,
} from './VlcPlayerViewNativeComponent';
