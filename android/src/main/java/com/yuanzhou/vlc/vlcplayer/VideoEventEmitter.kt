package com.yuanzhou.vlc.vlcplayer

import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter

internal class VideoEventEmitter(reactContext: ReactContext) {

    private val eventEmitter: RCTEventEmitter = reactContext.getJSModule(RCTEventEmitter::class.java)

    var viewId: Int = View.NO_ID

    fun loadStart() {
        receiveEvent(EVENT_LOAD_START, Arguments.createMap())
    }

    fun onVideoStateChange(payload: WritableMap) {
        receiveEvent(EVENT_ON_VIDEO_STATE_CHANGE, payload)
    }

    fun sendEvent(payload: WritableMap, event: String) {
        receiveEvent(event, payload)
    }

    private fun receiveEvent(type: String, payload: WritableMap) {
        eventEmitter.receiveEvent(viewId, type, payload)
    }

    companion object {
        const val EVENT_LOAD_START = "onVideoLoadStart"
        const val EVENT_ON_OPEN = "onVideoOpen"
        const val EVENT_PROGRESS = "onVideoProgress"
        const val EVENT_SEEK = "onVideoSeek"
        const val EVENT_END = "onVideoEnd"
        const val EVENT_ON_IS_PLAYING = "onVideoPlaying"
        const val EVENT_ON_VIDEO_STATE_CHANGE = "onVideoStateChange"
        const val EVENT_ON_VIDEO_STOPPED = "onVideoStopped"
        const val EVENT_ON_ERROR = "onVideoError"
        const val EVENT_ON_VIDEO_BUFFERING = "onVideoBuffering"
        const val EVENT_ON_PAUSED = "onVideoPaused"
        const val EVENT_ON_LOAD = "onVideoLoad"
        const val EVENT_RECORDING_STATE = "onRecordingState"
        const val EVENT_ON_SNAPSHOT = "onSnapshot"

        /** Every event the view manager registers as a direct event. */
        val Events = arrayOf(
            EVENT_LOAD_START,
            EVENT_PROGRESS,
            EVENT_SEEK,
            EVENT_END,
            EVENT_ON_IS_PLAYING,
            EVENT_ON_VIDEO_STATE_CHANGE,
            EVENT_ON_OPEN,
            EVENT_ON_PAUSED,
            EVENT_ON_VIDEO_BUFFERING,
            EVENT_ON_ERROR,
            EVENT_ON_VIDEO_STOPPED,
            EVENT_ON_LOAD,
            EVENT_RECORDING_STATE,
            EVENT_ON_SNAPSHOT,
        )
    }
}
