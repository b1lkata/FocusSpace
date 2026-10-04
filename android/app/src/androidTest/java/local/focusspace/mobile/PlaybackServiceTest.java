package local.focusspace.mobile;

import static org.junit.Assert.*;
import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.media3.common.MediaItem;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real native service test, using only an original bundled MP3 fixture. */
@RunWith(AndroidJUnit4.class)
public class PlaybackServiceTest {
    private void main(Runnable action) { InstrumentationRegistry.getInstrumentation().runOnMainSync(action); }
    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor result = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command)) {
            try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(result)) { while (input.read() != -1) {} }
        }
    }
    @Test public void localQueueAndControlsSurviveScreenOff() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File fixture = new File(context.getFilesDir(), "native-test-tone.mp3");
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("original-tone.mp3");
             FileOutputStream output = new FileOutputStream(fixture)) {
            byte[] buffer = new byte[8192]; int count; while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
        AtomicReference<ListenableFuture<MediaController>> future = new AtomicReference<>();
        MediaController controller = null;
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            main(() -> future.set(new MediaController.Builder(context, new SessionToken(context, new ComponentName(context, PlaybackService.class))).buildAsync()));
            controller = future.get().get(20, TimeUnit.SECONDS);
            MediaController player = controller;
            MediaItem first = new MediaItem.Builder().setMediaId("first").setUri(Uri.fromFile(fixture)).build();
            MediaItem second = new MediaItem.Builder().setMediaId("second").setUri(Uri.fromFile(fixture)).build();
            main(() -> { player.setMediaItems(Arrays.asList(first, second)); player.prepare(); player.play(); });
            long deadline = System.currentTimeMillis() + 15000;
            AtomicReference<Long> position = new AtomicReference<>(0L);
            while (position.get() < 200 && System.currentTimeMillis() < deadline) { Thread.sleep(100); main(() -> position.set(player.getCurrentPosition())); }
            assertTrue("Native MP3 must advance", position.get() >= 200);
            main(() -> { player.pause(); player.seekTo(500); assertFalse(player.getPlayWhenReady()); player.play(); });
            shell("input keyevent 3");
            shell("input keyevent 223");
            Thread.sleep(900);
            main(() -> { assertTrue("Still playing while screen off", player.getPlayWhenReady()); assertTrue(player.getCurrentPosition() > 900); });
            main(() -> { player.pause(); player.seekTo(0, Math.max(0, player.getDuration() - 500)); player.play(); });
            Thread.sleep(1500);
            main(() -> { assertEquals("Queue advances without foreground WebView", 1, player.getCurrentMediaItemIndex()); player.pause(); assertFalse(player.getPlayWhenReady()); player.play(); assertTrue(player.getPlayWhenReady()); });
        } finally {
            if (controller != null) { MediaController player = controller; main(() -> { player.stop(); player.clearMediaItems(); player.release(); }); }
            shell("input keyevent 224");
            fixture.delete();
        }
    }
}
