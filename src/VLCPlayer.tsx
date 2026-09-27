import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { ComponentRef } from 'react';
import {
  findNodeHandle,
  Image,
  StyleSheet,
  UIManager,
  requireNativeComponent,
  type HostComponent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type {
  OnPlayingEventProps,
  OnProgressEventProps,
  OnRecordingStateEventProps,
  OnSnapshotEventProps,
  PlaybackMethods,
  SimpleCallbackEventProps,
  VideoInfo,
  VLCPlayerCallbackProps,
  VLCPlayerNativeOnlyProps,
  VLCPlayerProps,
  VLCPlayerSource,
} from './types';

const COMPONENT_NAME = 'RCTVLCPlayer';

/**
 * The shape the native view actually receives. Deliberately loose: it is the
 * legacy `requireNativeComponent` contract, which Phase 2a replaces with a
 * codegen spec.
 */
type NativeVLCPlayerProps = {
  style?: StyleProp<ViewStyle>;
  source: VLCPlayerSource & { isNetwork?: boolean; autoplay?: boolean };
  src: {
    uri: string;
    isNetwork: boolean;
    isAsset: boolean;
    type: string;
    mainVer: number;
    patchVer: number;
  };
  progressUpdateInterval: number;
  onVideoLoadStart?: (
    e: NativeSyntheticEvent<SimpleCallbackEventProps>
  ) => void;
  onVideoOpen?: (e: NativeSyntheticEvent<SimpleCallbackEventProps>) => void;
  onVideoError?: (e: NativeSyntheticEvent<SimpleCallbackEventProps>) => void;
  onVideoProgress?: (e: NativeSyntheticEvent<OnProgressEventProps>) => void;
  onVideoEnded?: (e: NativeSyntheticEvent<SimpleCallbackEventProps>) => void;
  onVideoEnd?: (e: NativeSyntheticEvent<SimpleCallbackEventProps>) => void;
  onVideoPlaying?: (e: NativeSyntheticEvent<OnPlayingEventProps>) => void;
  onVideoPaused?: (e: NativeSyntheticEvent<SimpleCallbackEventProps>) => void;
  onVideoStopped?: () => void;
  onVideoBuffering?: (
    e: NativeSyntheticEvent<SimpleCallbackEventProps>
  ) => void;
  onVideoLoad?: (e: NativeSyntheticEvent<VideoInfo>) => void;
  onRecordingState?: (
    e: NativeSyntheticEvent<OnRecordingStateEventProps>
  ) => void;
  onSnapshot?: (e: NativeSyntheticEvent<OnSnapshotEventProps>) => void;
} & Omit<VLCPlayerProps, 'source' | 'style' | keyof VLCPlayerCallbackProps> &
  VLCPlayerNativeOnlyProps;

const RCTVLCPlayer: HostComponent<NativeVLCPlayerProps> =
  requireNativeComponent<NativeVLCPlayerProps>(COMPONENT_NAME);

type NativeRef = ComponentRef<HostComponent<NativeVLCPlayerProps>>;

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

/**
 * Resolve the `source` prop into the object the native side expects.
 *
 * `Image.resolveAssetSource` returns object sources unchanged, so everything
 * below works on a copy: the previous implementation mutated the caller's own
 * object (including pushing `--repeat` into their `initOptions` array).
 */
function resolveSource(
  source: VLCPlayerProps['source'],
  autoplay: boolean,
  repeat: boolean | undefined
) {
  const resolved =
    typeof source === 'number'
      ? ((Image.resolveAssetSource(source) ?? {}) as VLCPlayerSource)
      : (source ?? ({} as VLCPlayerSource));

  let uri = resolved.uri || '';
  if (uri.match(/^\//)) {
    uri = `file://${uri}`;
  }

  const isAsset = !!uri.match(
    /^(assets-library|file|content|ms-appx|ms-appdata):/
  );
  let isNetwork = !!uri.match(/^https?:/);
  if (!isAsset) {
    isNetwork = true;
  }
  if (resolved.uri && resolved.uri.match(/^\//)) {
    isNetwork = false;
  }

  const initOptions = [...(resolved.initOptions ?? [])];
  if (repeat) {
    const hasRepeat = initOptions.some(
      (item) => item.startsWith('--repeat') || item.startsWith('--input-repeat')
    );
    if (!hasRepeat) {
      initOptions.push('--repeat');
    }
  }

  return {
    source: { ...resolved, initOptions, isNetwork, autoplay },
    src: {
      uri,
      isNetwork,
      isAsset,
      type: resolved.type || '',
      mainVer: resolved.mainVer || 0,
      patchVer: resolved.patchVer || 0,
    },
  };
}

/**
 * A component that can be used to show a playback.
 *
 * The imperative methods are reachable through a ref:
 *
 * ```tsx
 * const player = useRef<VLCPlayerRef>(null);
 * <VLCPlayer ref={player} source={{ uri }} />
 * player.current?.seek(0.5);
 * ```
 */
const VLCPlayer = forwardRef<PlaybackMethods, VLCPlayerProps>(
  function VLCPlayer(props, ref) {
    const {
      autoplay = true,
      onBuffering,
      onEnd,
      onError,
      onLoad,
      onLoadStart,
      onOpen,
      onPaused,
      onPlaying,
      onProgress,
      onRecordingCreated,
      onSnapshot,
      onStopped,
      repeat,
      source,
      style,
      ...rest
    } = props;

    const nativeRef = useRef<NativeRef | null>(null);
    const lastRecording = useRef<string | undefined>(undefined);

    const setNativeProps = useCallback(
      (nativeProps: Partial<VLCPlayerProps> & VLCPlayerNativeOnlyProps) => {
        nativeRef.current?.setNativeProps(nativeProps);
      },
      []
    );

    const dispatchCommand = useCallback(
      (command: string, args: unknown[] = []) => {
        const node = findNodeHandle(nativeRef.current);
        if (node == null) {
          return;
        }
        UIManager.dispatchViewManagerCommand(
          node,
          UIManager.getViewManagerConfig(COMPONENT_NAME).Commands[command],
          args
        );
      },
      []
    );

    useImperativeHandle(
      ref,
      (): PlaybackMethods => ({
        startRecording: (path) => dispatchCommand('startRecording', [path]),
        stopRecording: () => dispatchCommand('stopRecording'),
        stopPlayer: () => dispatchCommand('stopPlayer'),
        snapshot: (path) => dispatchCommand('snapshot', [path]),
        seek: (pos) => setNativeProps({ seek: pos }),
        resume: (isResume) => setNativeProps({ resume: isResume }),
        autoAspectRatio: (isAuto) =>
          setNativeProps({ autoAspectRatio: isAuto }),
        changeVideoAspectRatio: (ratio) =>
          setNativeProps({ videoAspectRatio: ratio }),
        setNativeProps,
      }),
      [dispatchCommand, setNativeProps]
    );

    const handleStopped = useCallback(() => {
      setNativeProps({ paused: true });
      onStopped?.();
    }, [onStopped, setNativeProps]);

    const handleRecordingState = useCallback(
      (event: NativeSyntheticEvent<OnRecordingStateEventProps>) => {
        const { isRecording, recordPath } = event.nativeEvent;
        if (lastRecording.current === recordPath) {
          return;
        }
        if (!isRecording && recordPath) {
          lastRecording.current = recordPath;
          onRecordingCreated?.(recordPath);
        }
      },
      [onRecordingCreated]
    );

    const handleSnapshot = useCallback(
      (event: NativeSyntheticEvent<OnSnapshotEventProps>) => {
        if (event.nativeEvent.success) {
          onSnapshot?.(event.nativeEvent);
        }
      },
      [onSnapshot]
    );

    const resolved = resolveSource(source, autoplay, repeat);

    return (
      <RCTVLCPlayer
        ref={nativeRef}
        {...rest}
        autoplay={autoplay}
        repeat={repeat}
        style={[styles.base, style]}
        source={resolved.source}
        src={resolved.src}
        onVideoLoadStart={(e) => onLoadStart?.(e.nativeEvent)}
        onVideoOpen={(e) => onOpen?.(e.nativeEvent)}
        onVideoError={(e) => onError?.(e.nativeEvent)}
        onVideoProgress={(e) => onProgress?.(e.nativeEvent)}
        onVideoEnded={(e) => onEnd?.(e.nativeEvent)}
        onVideoEnd={(e) => onEnd?.(e.nativeEvent)}
        onVideoPlaying={(e) => onPlaying?.(e.nativeEvent)}
        onVideoPaused={(e) => onPaused?.(e.nativeEvent)}
        onVideoStopped={handleStopped}
        onVideoBuffering={(e) => onBuffering?.(e.nativeEvent)}
        onVideoLoad={(e) => onLoad?.(e.nativeEvent)}
        onRecordingState={handleRecordingState}
        onSnapshot={handleSnapshot}
        progressUpdateInterval={onProgress ? 250 : 0}
      />
    );
  }
);

export default VLCPlayer;
