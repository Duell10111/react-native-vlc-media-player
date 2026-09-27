#import "RCTVLCPlayerManager.h"
#import "RCTVLCPlayer.h"
#import "React/RCTBridge.h"
#import "React/RCTUIManager.h"
#import "React/RCTLog.h"

@implementation RCTVLCPlayerManager

RCT_EXPORT_MODULE();

@synthesize bridge = _bridge;

- (UIView *)view
{
    return [[RCTVLCPlayer alloc] initWithEventDispatcher:self.bridge.eventDispatcher];
}

/* Should support: onLoadStart, onLoad, and onError to stay consistent with Image */
RCT_EXPORT_VIEW_PROPERTY(onVideoProgress, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoPaused, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoStopped, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoBuffering, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoPlaying, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoEnded, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoError, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoOpen, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoLoadStart, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onVideoLoad, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onRecordingState, RCTDirectEventBlock);
RCT_EXPORT_VIEW_PROPERTY(onSnapshot, RCTDirectEventBlock);

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

RCT_EXPORT_VIEW_PROPERTY(source, NSDictionary);
RCT_EXPORT_VIEW_PROPERTY(subtitleUri, NSString);
RCT_EXPORT_VIEW_PROPERTY(paused, BOOL);
RCT_EXPORT_VIEW_PROPERTY(seek, float);
RCT_EXPORT_VIEW_PROPERTY(rate, float);
RCT_EXPORT_VIEW_PROPERTY(resume, BOOL);
RCT_EXPORT_VIEW_PROPERTY(videoAspectRatio, NSString);
RCT_EXPORT_VIEW_PROPERTY(snapshotPath, NSString);
RCT_CUSTOM_VIEW_PROPERTY(muted, BOOL, RCTVLCPlayer)
{
    BOOL isMuted = [RCTConvert BOOL:json];
    [view setMuted:isMuted];
};
RCT_EXPORT_VIEW_PROPERTY(audioTrack, int);
RCT_EXPORT_VIEW_PROPERTY(textTrack, int);
RCT_EXPORT_VIEW_PROPERTY(autoplay, BOOL);
RCT_EXPORT_VIEW_PROPERTY(acceptInvalidCertificates, BOOL);

// Commands are declared in src/VlcPlayerViewNativeComponent.ts. codegen dispatches
// them by name; RCTUIManager resolves the name against the methods exported here
// and prepends the react tag.
//
// Phase 2b replaces this whole block: the bridge-bound uiManager lookup does not
// exist under Bridgeless. Keeping it in one place with one helper is what makes
// that a deletion rather than a rewrite.
- (void)withView:(nonnull NSNumber *)reactTag perform:(void (^)(RCTVLCPlayer *view))block
{
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
        UIView *view = viewRegistry[reactTag];
        if (![view isKindOfClass:[RCTVLCPlayer class]]) {
            RCTLogError(@"Cannot find RCTVLCPlayer with tag #%@", reactTag);
            return;
        }
        block((RCTVLCPlayer *)view);
    }];
}

RCT_EXPORT_METHOD(startRecording:(nonnull NSNumber *)reactTag withPath:(NSString *)path) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view startRecording:path]; }];
}

RCT_EXPORT_METHOD(stopRecording:(nonnull NSNumber *)reactTag) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view stopRecording]; }];
}

RCT_EXPORT_METHOD(stopPlayer:(nonnull NSNumber *)reactTag) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view stopPlayer]; }];
}

RCT_EXPORT_METHOD(snapshot:(nonnull NSNumber *)reactTag withPath:(NSString *)path) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view snapshot:path]; }];
}

RCT_EXPORT_METHOD(seek:(nonnull NSNumber *)reactTag position:(nonnull NSNumber *)position) {
    float pos = [position floatValue];
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view setSeek:pos]; }];
}

RCT_EXPORT_METHOD(applyResume:(nonnull NSNumber *)reactTag isResume:(BOOL)isResume) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view setResume:isResume]; }];
}

RCT_EXPORT_METHOD(applyPaused:(nonnull NSNumber *)reactTag paused:(BOOL)paused) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view setPaused:paused]; }];
}

RCT_EXPORT_METHOD(applyAspectRatio:(nonnull NSNumber *)reactTag ratio:(NSString *)ratio) {
    [self withView:reactTag perform:^(RCTVLCPlayer *view) { [view setVideoAspectRatio:ratio]; }];
}

// MobileVLCKit has no automatic aspect ratio on this code path, so iOS answers the
// command with nothing. It is declared so the command exists on both platforms and
// RCTUIManager does not log "No command found with name".
RCT_EXPORT_METHOD(applyAutoAspectRatio:(nonnull NSNumber *)reactTag isAuto:(BOOL)isAuto) {
}

@end
