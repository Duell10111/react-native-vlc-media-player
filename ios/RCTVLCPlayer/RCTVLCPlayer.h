#import "React/RCTView.h"
#if TARGET_OS_TV
#import <TVVLCKit/TVVLCKit.h>
#else
#import <MobileVLCKit/MobileVLCKit.h>
#endif

@class RCTEventDispatcher;

@interface RCTVLCPlayer : UIView <VLCCustomDialogRendererProtocol>

@property (nonatomic, copy) RCTDirectEventBlock onVideoProgress;
@property (nonatomic, copy) RCTDirectEventBlock onVideoPaused;
@property (nonatomic, copy) RCTDirectEventBlock onVideoStopped;
@property (nonatomic, copy) RCTDirectEventBlock onVideoBuffering;
@property (nonatomic, copy) RCTDirectEventBlock onVideoPlaying;
@property (nonatomic, copy) RCTDirectEventBlock onVideoEnded;
@property (nonatomic, copy) RCTDirectEventBlock onVideoError;
@property (nonatomic, copy) RCTDirectEventBlock onVideoOpen;
@property (nonatomic, copy) RCTDirectEventBlock onVideoLoadStart;
@property (nonatomic, copy) RCTDirectEventBlock onVideoLoad;
@property (nonatomic, copy) RCTDirectEventBlock onRecordingState;
@property (nonatomic, copy) RCTDirectEventBlock onSnapshot;

@property (nonatomic, strong) VLCDialogProvider *dialogProvider;
@property (nonatomic, assign) BOOL acceptInvalidCertificates;

- (instancetype)initWithEventDispatcher:(RCTEventDispatcher *)eventDispatcher NS_DESIGNATED_INITIALIZER;
- (void)setMuted:(BOOL)value;
- (void)startRecording:(NSString*)path;
- (void)stopRecording;
- (void)stopPlayer;
- (void)snapshot:(NSString*)path;

// Implemented in RCTVLCPlayer.m and previously only reached through
// RCT_EXPORT_VIEW_PROPERTY. Declared here because the view manager now also calls
// them from the codegen commands.
- (void)setSeek:(float)pos;
- (void)setResume:(BOOL)resume;
- (void)setPaused:(BOOL)paused;
- (void)setVideoAspectRatio:(NSString *)ratio;
@end
