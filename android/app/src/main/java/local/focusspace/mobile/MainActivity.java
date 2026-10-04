package local.focusspace.mobile;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(FocusAudioPlugin.class);
        super.onCreate(state);
    }
    @Override public void onResume() {
        super.onResume();
        // Request a fresh native frame after screen-off; keep the current page/player state.
        if (bridge != null) bridge.getWebView().postInvalidateOnAnimation();
    }
}
