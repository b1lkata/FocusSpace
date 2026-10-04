package local.focusspace.mobile;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import androidx.core.util.AtomicFile;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "FocusAudio")
public class FocusAudioPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private ListenableFuture<MediaController> connection;
    private MediaController player;
    private String lastError;
    private long sleepDeadline = 0;
    private final Runnable ticker = new Runnable() {
        @Override public void run() { if (player != null) { if (sleepDeadline > 0 && android.os.SystemClock.elapsedRealtime() >= sleepDeadline) { player.pause(); sleepDeadline = 0; } emit(); } main.postDelayed(this, 500); }
    };
    @Override public void load() {
        main.post(() -> {
            SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
            connection = new MediaController.Builder(getContext(), token).buildAsync();
            connection.addListener(() -> {
                try {
                    player = connection.get();
                    player.addListener(new Player.Listener() {
                        @Override public void onEvents(Player p, Player.Events events) { emit(); }
                        @Override public void onPlayerError(PlaybackException error) {
                            lastError = "Audio could not play. Try another song or connection."; emit();
                        }
                    });
                    main.post(ticker);
                } catch (Exception error) { lastError = "Audio service could not connect."; emit(); }
            }, ContextCompat.getMainExecutor(getContext()));
        });
    }
    private interface Action { void run() throws Exception; }
    private void command(PluginCall call, Action action) {
        main.post(() -> {
            if (connection == null) { call.reject("Audio service is not ready."); return; }
            connection.addListener(() -> {
                try {
                    if (player == null) player = connection.get();
                    action.run(); call.resolve(); emit();
                } catch (Exception error) { call.reject("Audio command failed: " + error.getMessage()); }
            }, ContextCompat.getMainExecutor(getContext()));
        });
    }
    private float level(PluginCall call) {
        Double value = call.getDouble("volume", .65);
        return (float)Math.max(0, Math.min(1, Double.isFinite(value) ? value : .65));
    }
    private MediaItem item(String id, String title, String artist, Uri uri, boolean local) {
        Bundle extras = new Bundle(); extras.putBoolean("local", local);
        return new MediaItem.Builder().setMediaId(id).setUri(uri)
            .setMediaMetadata(new MediaMetadata.Builder().setTitle(title).setArtist(artist).setExtras(extras).build()).build();
    }
    @PluginMethod public void play(PluginCall call) {
        try {
            JSArray input = call.getArray("tracks");
            int index = call.getInt("index", 0);
            if (input == null || input.length() < 1 || input.length() > 50 || index < 0 || index >= input.length()) throw new Exception("Invalid queue");
            List<MediaItem> queue = new ArrayList<>();
            for (int i = 0; i < input.length(); i++) {
                JSONObject track = input.getJSONObject(i);
                String id = track.getString("id"), title = track.getString("title"), artist = track.getString("artist");
                Uri uri = Uri.parse(track.getString("url"));
                boolean audius = id.matches("[A-Za-z0-9]{1,32}") && "api.audius.co".equals(uri.getHost()) && ("/v1/tracks/" + id + "/stream").equals(uri.getPath());
                boolean archive = id.matches("ia:[A-Za-z0-9_.-]{1,200}:[0-9]{1,2}") && "archive.org".equals(uri.getHost()) && uri.getPath().startsWith("/download/" + id.split(":")[1] + "/") && uri.getPath().toLowerCase().endsWith(".mp3") && !uri.getPath().contains("/../") && !uri.getPath().contains("/./");
                boolean mixter = id.matches("cc[0-9]{1,15}") && "ccmixter.org".equals(uri.getHost()) && uri.getPath().startsWith("/content/") && uri.getPath().toLowerCase().endsWith(".mp3") && !uri.getPath().contains("/../") && !uri.getPath().contains("/./");
                boolean jamendo = (id.matches("ov:[A-Fa-f0-9-]{36}") || (id.matches("jm:[0-9]{1,15}") && id.substring(3).equals(uri.getQueryParameter("trackid")))) && "prod-1.storage.jamendo.com".equals(uri.getHost()) && "/".equals(uri.getPath()) && uri.getQueryParameter("trackid") != null && uri.getQueryParameter("trackid").matches("[0-9]{1,15}") && ("mp31".equals(uri.getQueryParameter("format")) || "mp32".equals(uri.getQueryParameter("format"))) && uri.getQueryParameterNames().stream().allMatch(key -> key.equals("trackid") || key.equals("format"));
                if ((!audius && !archive && !mixter && !jamendo) || title.length() > 500 || artist.length() > 500
                    || !"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getPort() != -1 || uri.getFragment() != null) throw new Exception("Invalid track");
                queue.add(item(id, title, artist, uri, false));
            }
            command(call, () -> { lastError = null; player.setVolume(level(call)); player.setMediaItems(queue, index, 0); player.prepare(); player.play(); });
        } catch (Exception error) { call.reject("Invalid audio queue."); }
    }
    @PluginMethod public void playLocal(PluginCall call) {
        String id = call.getString("id", ""), title = call.getString("title", ""), ext = call.getString("extension", "");
        String data = call.getString("data", "");
        if (!id.matches("[A-Fa-f0-9]{8}(-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}") || title.length() > 500
            || !Arrays.asList("mp3", "wav", "m4a", "ogg", "flac").contains(ext) || data.length() > 70 * 1024 * 1024) {
            call.reject("Invalid local audio file."); return;
        }
        files.execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > 50 * 1024 * 1024) throw new Exception("Invalid file size");
                File folder = new File(getContext().getFilesDir(), "FocusAudio");
                if (!folder.isDirectory() && !folder.mkdirs()) throw new Exception("Storage unavailable");
                File target = new File(folder, id + "." + ext);
                AtomicFile file = new AtomicFile(target);
                FileOutputStream stream = null;
                try { stream = file.startWrite(); stream.write(bytes); file.finishWrite(stream); }
                catch (Exception error) { if (stream != null) file.failWrite(stream); throw error; }
                MediaItem track = item(id, title, "Your music", Uri.fromFile(target), true);
                command(call, () -> { lastError = null; player.setVolume(level(call)); player.setMediaItem(track); player.prepare(); player.play(); });
            } catch (Exception error) { call.reject("Could not store or play this audio file."); }
        });
    }
    @PluginMethod public void pause(PluginCall call) { command(call, () -> player.pause()); }
    @PluginMethod public void resume(PluginCall call) { command(call, () -> { lastError = null; if (player.getPlaybackState() == Player.STATE_IDLE) player.prepare(); player.play(); }); }
    @PluginMethod public void stop(PluginCall call) { command(call, () -> { player.stop(); player.clearMediaItems(); lastError = null; }); }
    @PluginMethod public void seek(PluginCall call) { command(call, () -> { double time = call.getDouble("time", 0.0); if (Double.isFinite(time)) player.seekTo(Math.max(0, (long)(time * 1000))); }); }
    @PluginMethod public void volume(PluginCall call) { command(call, () -> player.setVolume(level(call))); }
    @PluginMethod public void skip(PluginCall call) {
        int delta = call.getInt("delta", 1);
        if (delta != -1 && delta != 1) { call.reject("Invalid direction."); return; }
        command(call, () -> { int count = player.getMediaItemCount(); if (count > 0) { player.seekToDefaultPosition((player.getCurrentMediaItemIndex() + delta + count) % count); player.prepare(); player.play(); } });
    }
    @PluginMethod public void playbackOptions(PluginCall call) {
        String repeat = call.getString("repeat"); Integer minutes = call.getInt("sleepMinutes");
        if (repeat != null && !Arrays.asList("off", "all", "one").contains(repeat)) { call.reject("Invalid repeat mode"); return; }
        if (minutes != null && !Arrays.asList(0,15,30,60).contains(minutes)) { call.reject("Invalid sleep timer"); return; }
        command(call, () -> { if (repeat != null) player.setRepeatMode("one".equals(repeat) ? Player.REPEAT_MODE_ONE : "all".equals(repeat) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF); if (minutes != null) sleepDeadline = minutes == 0 ? 0 : android.os.SystemClock.elapsedRealtime() + minutes * 60_000L; });
    }
    @PluginMethod public void reorderQueue(PluginCall call) {
        command(call, () -> {
            JSArray order = call.getArray("order"); int count = player.getMediaItemCount(), current = player.getCurrentMediaItemIndex();
            if (order == null || order.length() != count || count > 50) throw new IllegalArgumentException("Invalid queue order");
            boolean[] seen = new boolean[count]; List<MediaItem> upcoming = new ArrayList<>();
            for (int i = 0; i < count; i++) { int original = order.getInt(i); if (original < 0 || original >= count || seen[original] || (i <= current && original != i)) throw new IllegalArgumentException("Current song must stay in place"); seen[original] = true; if (i > current) upcoming.add(player.getMediaItemAt(original)); }
            player.replaceMediaItems(current + 1, count, upcoming);
        });
    }
    @PluginMethod public void editQueue(PluginCall call) {
        command(call, () -> {
            int from = call.getInt("from", -1), to = call.getInt("to", -1);
            int current = player.getCurrentMediaItemIndex(), count = player.getMediaItemCount();
            if (from <= current || from >= count || (to != -1 && (to <= current || to >= count))) throw new IllegalArgumentException("Only upcoming songs can change");
            if (to == -1) player.removeMediaItem(from); else player.moveMediaItem(from, to);
        });
    }
    private JSObject snapshot() {
        JSObject state = new JSObject(); state.put("sleepActive", sleepDeadline > 0); MediaItem current = player == null ? null : player.getCurrentMediaItem();
        state.put("id", current == null ? "" : current.mediaId);
        state.put("local", current != null && current.mediaMetadata.extras != null && current.mediaMetadata.extras.getBoolean("local"));
        state.put("playing", player != null && player.getPlayWhenReady() && player.getPlaybackState() != Player.STATE_ENDED && player.getPlaybackState() != Player.STATE_IDLE);
        state.put("time", player == null ? 0 : Math.max(0, player.getCurrentPosition()) / 1000.0);
        long duration = player == null ? 0 : player.getDuration(); state.put("duration", duration == C.TIME_UNSET ? 0 : Math.max(0, duration) / 1000.0);
        if (lastError != null) state.put("error", lastError);
        return state;
    }
    private void emit() { notifyListeners("playback", snapshot()); }
    @PluginMethod public void state(PluginCall call) { main.post(() -> call.resolve(snapshot())); }
    @Override protected void handleOnDestroy() {
        main.removeCallbacksAndMessages(null); files.shutdown();
        if (connection != null) MediaController.releaseFuture(connection);
        player = null;
    }
}
