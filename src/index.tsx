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
  OnSnapshotEventProps,
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
