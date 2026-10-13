package com.yuanzhou.vlc.vlcplayer

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class VlcPlayerViewManager : SimpleViewManager<VlcPlayerView>() {

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): VlcPlayerView =
        VlcPlayerView(reactContext)

    override fun onDropViewInstance(view: VlcPlayerView) {
        view.cleanUpResources()
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
        VideoEventEmitter.Events.associateWith { mapOf("registrationName" to it) }

    @ReactProp(name = PROP_CLEAR)
    fun setClear(view: VlcPlayerView, @Suppress("UNUSED_PARAMETER") clear: Boolean) {
        view.cleanUpResources()
    }

    @ReactProp(name = PROP_SRC)
    fun setSrc(view: VlcPlayerView, src: ReadableMap?) {
        // The Java version also read isNetwork and autoplay here with getBoolean,
        // which throws on a missing key, and then discarded both values.
        val uri = if (src != null && src.hasKey(PROP_SRC_URI)) src.getString(PROP_SRC_URI) else null
        if (uri.isNullOrEmpty()) {
            return
        }
        view.setSrc(src)
    }

    @ReactProp(name = PROP_SUBTITLE_URI)
    fun setSubtitleUri(view: VlcPlayerView, subtitleUri: String?) {
        view.setSubtitleUri(subtitleUri)
    }

    @ReactProp(name = PROP_REPEAT, defaultBoolean = false)
    fun setRepeat(view: VlcPlayerView, repeat: Boolean) {
        view.setRepeatModifier(repeat)
    }

    @ReactProp(name = PROP_PROGRESS_UPDATE_INTERVAL, defaultFloat = 0f)
    fun setInterval(view: VlcPlayerView, interval: Float) {
        view.setProgressUpdateInterval(interval)
    }

    @ReactProp(name = PROP_PAUSED, defaultBoolean = false)
    fun setPaused(view: VlcPlayerView, paused: Boolean) {
        view.setPausedModifier(paused)
    }

    @ReactProp(name = PROP_MUTED, defaultBoolean = false)
    fun setMuted(view: VlcPlayerView, muted: Boolean) {
        view.setMutedModifier(muted)
    }

    @ReactProp(name = PROP_VOLUME, defaultFloat = 1.0f)
    fun setVolume(view: VlcPlayerView, volume: Float) {
        view.setVolumeModifier(volume.toInt())
    }

    @ReactProp(name = PROP_SEEK)
    fun setSeek(view: VlcPlayerView, seek: Float) {
        view.setPosition(seek)
    }

    @ReactProp(name = PROP_AUTO_ASPECT_RATIO, defaultBoolean = false)
    fun setAutoAspectRatio(view: VlcPlayerView, auto: Boolean) {
        view.setAutoAspectRatio(auto)
    }

    @ReactProp(name = PROP_RESUME, defaultBoolean = true)
    fun setResume(view: VlcPlayerView, autoplay: Boolean) {
        view.doResume(autoplay)
    }

    @ReactProp(name = PROP_RATE)
    fun setRate(view: VlcPlayerView, rate: Float) {
        view.setRateModifier(rate)
    }

    @ReactProp(name = PROP_VIDEO_ASPECT_RATIO)
    fun setVideoAspectRatio(view: VlcPlayerView, aspectRatio: String?) {
        view.setAspectRatio(aspectRatio)
    }

    @ReactProp(name = PROP_AUDIO_TRACK)
    fun setAudioTrack(view: VlcPlayerView, audioTrack: Int) {
        view.setAudioTrack(audioTrack)
    }

    @ReactProp(name = PROP_TEXT_TRACK)
    fun setTextTrack(view: VlcPlayerView, textTrack: Int) {
        view.setTextTrack(textTrack)
    }

    @ReactProp(name = PROP_ACCEPT_INVALID_CERTIFICATES, defaultBoolean = false)
    fun setAcceptInvalidCertificates(view: VlcPlayerView, accept: Boolean) {
        view.setAcceptInvalidCertificates(accept)
    }

    override fun getCommandsMap(): Map<String, Int> =
        COMMANDS.withIndex().associate { (index, name) -> name to index + 1 }

    /**
     * Retained for anything still dispatching integer ids by hand. codegen
     * dispatches command names, so the String overload below is the live path.
     */
    @Deprecated("Dispatch commands by name")
    override fun receiveCommand(root: VlcPlayerView, commandId: Int, args: ReadableArray?) {
        if (commandId in 1..COMMANDS.size) {
            receiveCommand(root, COMMANDS[commandId - 1], args)
        }
    }

    override fun receiveCommand(root: VlcPlayerView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "startRecording" -> root.startRecording(stringArg(args))
            "stopRecording" -> root.stopRecording()
            "stopPlayer" -> root.stopPlayer()
            "snapshot" -> stringArg(args)?.let { root.doSnapshot(it) }
            "seek" -> if (args != null && hasArg(args)) root.setPosition(args.getDouble(0).toFloat())
            "applyResume" -> if (args != null && hasArg(args)) root.doResume(args.getBoolean(0))
            "applyPaused" -> if (args != null && hasArg(args)) root.setPausedModifier(args.getBoolean(0))
            "applyAutoAspectRatio" -> if (args != null && hasArg(args)) root.setAutoAspectRatio(args.getBoolean(0))
            "applyAspectRatio" -> root.setAspectRatio(stringArg(args))
        }
    }

    private companion object {
        const val REACT_CLASS = "RCTVLCPlayer"

        const val PROP_SRC = "source"
        const val PROP_SRC_URI = "uri"
        const val PROP_SUBTITLE_URI = "subtitleUri"
        const val PROP_REPEAT = "repeat"
        const val PROP_PAUSED = "paused"
        const val PROP_MUTED = "muted"
        const val PROP_VOLUME = "volume"
        const val PROP_SEEK = "seek"
        const val PROP_RESUME = "resume"
        const val PROP_RATE = "rate"
        const val PROP_VIDEO_ASPECT_RATIO = "videoAspectRatio"
        const val PROP_AUTO_ASPECT_RATIO = "autoAspectRatio"
        const val PROP_CLEAR = "clear"
        const val PROP_PROGRESS_UPDATE_INTERVAL = "progressUpdateInterval"
        const val PROP_TEXT_TRACK = "textTrack"
        const val PROP_AUDIO_TRACK = "audioTrack"
        const val PROP_ACCEPT_INVALID_CERTIFICATES = "acceptInvalidCertificates"

        /**
         * The commands the JS spec (src/VlcPlayerViewNativeComponent.ts) declares.
         * The first three keep their historical integer ids.
         */
        val COMMANDS = listOf(
            "startRecording",
            "stopRecording",
            "snapshot",
            "stopPlayer",
            "seek",
            "applyResume",
            "applyPaused",
            "applyAutoAspectRatio",
            "applyAspectRatio",
        )

        fun hasArg(args: ReadableArray): Boolean = args.size() > 0 && !args.isNull(0)

        fun stringArg(args: ReadableArray?): String? =
            if (args != null && hasArg(args)) args.getString(0) else null
    }
}
