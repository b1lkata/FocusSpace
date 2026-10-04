/** Original synthesized ambience. No artist recordings, streaming API or autoplay. */
export class AmbientAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private timer?: number;
  async play(frequencies: readonly number[], volume: number) {
    this.stop();
    const context = new AudioContext(); this.context = context;
    const gain = context.createGain(); gain.gain.value = volume; gain.connect(context.destination); this.gain = gain;
    await context.resume();
    if (this.context !== context) return;
    const chord = () => {
      if (context.state !== 'running') return;
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), envelope = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        const time = context.currentTime + index * .18;
        envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(.045, time + .9); envelope.gain.exponentialRampToValueAtTime(.001, time + 5.5);
        oscillator.connect(envelope); envelope.connect(gain); oscillator.start(time); oscillator.stop(time + 6);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      });
    };
    chord(); this.timer = window.setInterval(chord, 4000);
  }
  volume(value: number) { if (this.context && this.gain) this.gain.gain.setTargetAtTime(value, this.context.currentTime, .05); }
  stop() { window.clearInterval(this.timer); this.timer = undefined; const context = this.context; this.context = undefined; this.gain = undefined; if (context && context.state !== 'closed') void context.close(); }
}
