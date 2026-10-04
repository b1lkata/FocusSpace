package local.focusspace.mobile;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Playback belongs to the service, not the suspended WebView. */
public class PlaybackService extends MediaSessionService {
    private MediaSession session;
    @Override public void onCreate() {
        super.onCreate();
        ExoPlayer player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        Intent launch = new Intent(this, MainActivity.class);
        PendingIntent activity = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        session = new MediaSession.Builder(this, player).setSessionActivity(activity).build();
    }
    @androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller) {
        return getPackageName().equals(controller.getPackageName()) || controller.isTrusted() ? session : null;
    }
    @Override public void onDestroy() {
        if (session != null) { session.getPlayer().release(); session.release(); session = null; }
        super.onDestroy();
    }
}
