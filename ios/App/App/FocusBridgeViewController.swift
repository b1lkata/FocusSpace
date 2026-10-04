import Capacitor

class FocusBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FocusAudioPlugin())
    }
}
