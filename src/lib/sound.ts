/**
 * Comprehensive Audio Alert and Notification Sound Manager
 * Handles:
 * - Autoplay unlocking via user gesture on mobile browsers (Android/iOS)
 * - Silent buffer audio unlock for Web Audio API + HTMLAudioElement preloading
 * - Multi-tab deduplication and burst throttling
 * - Graceful fallback to Web Audio API synthesis
 * - Blocked playback detection and subscriber notification
 */

export interface SoundState {
  soundEnabled: boolean;
  audioUnlocked: boolean;
  audioBlocked: boolean;
  isRinging: boolean;
  ringingOfferId: string | null;
}

const STORAGE_KEY_SOUND_ENABLED = "lar_sound_alerts_enabled";
const STORAGE_KEY_LAST_SOUND = "lar_last_sound_event";
const BURST_COOLDOWN_MS = 1000; // Group bursts within 1s into a single chime

class SoundManager {
  private audioContext: AudioContext | null = null;
  private preloadedAudio: HTMLAudioElement | null = null;
  private ringingAudio: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;
  private audioUnlocked: boolean = false;
  private audioBlocked: boolean = false;
  private lastPlayedTime: number = 0;
  private subscribers: Set<(state: SoundState) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private ringingOfferId: string | null = null;
  private ringingInterval: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      // Load saved preference (default: enabled)
      const saved = localStorage.getItem(STORAGE_KEY_SOUND_ENABLED);
      this.soundEnabled = saved !== "false";

      // Pre-load notification sound asset (subtle chime for notifications)
      try {
        this.preloadedAudio = new Audio("/sounds/notification.mp3");
        this.preloadedAudio.preload = "auto";
        this.preloadedAudio.volume = 0.75;
        this.preloadedAudio.load();
      } catch {}

      // Pre-load persistent incoming trip ringing audio (reserved exclusively for driver ride offers)
      try {
        this.ringingAudio = new Audio("/sounds/incoming-trip.mp3");
        this.ringingAudio.preload = "auto";
        this.ringingAudio.loop = true;
        this.ringingAudio.volume = 0.9;
        this.ringingAudio.load();
      } catch {}

      // Setup BroadcastChannel for cross-tab audio deduplication
      try {
        if ("BroadcastChannel" in window) {
          this.broadcastChannel = new BroadcastChannel("lar_notification_audio");
          this.broadcastChannel.onmessage = (e) => {
            if (e.data?.timestamp) {
              this.lastPlayedTime = Math.max(this.lastPlayedTime, e.data.timestamp);
            }
          };
        }
      } catch {
        // Fallback to localStorage
      }

      // Automatically attempt unlock on first user gesture
      const autoUnlock = () => {
        if (!this.audioUnlocked) {
          this.unlockAudio().catch(() => {});
        }
      };
      window.addEventListener("click", autoUnlock, { once: true, passive: true });
      window.addEventListener("touchend", autoUnlock, { once: true, passive: true });
      window.addEventListener("keydown", autoUnlock, { once: true, passive: true });
    }
  }

  public getState(): SoundState {
    return {
      soundEnabled: this.soundEnabled,
      audioUnlocked: this.audioUnlocked,
      audioBlocked: this.audioBlocked,
      isRinging: Boolean(this.ringingOfferId),
      ringingOfferId: this.ringingOfferId,
    };
  }

  public subscribe(callback: (state: SoundState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    const state = this.getState();
    if (typeof window !== "undefined") {
      setTimeout(() => {
        this.subscribers.forEach((cb) => {
          try {
            cb(state);
          } catch {}
        });
      }, 0);
    } else {
      this.subscribers.forEach((cb) => {
        try {
          cb(state);
        } catch {}
      });
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SOUND_ENABLED, enabled ? "true" : "false");
    }
    this.notify();
  }

  /**
   * Initializes and resumes AudioContext and preloaded HTMLAudio on direct user gesture.
   * Plays a 1-sample silent Web Audio buffer to satisfy mobile Chrome/Safari autoplay policies.
   */
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext && AudioCtx) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext && this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Play 1-sample silent buffer to unlock Web Audio on mobile WebKit / Blink
      if (this.audioContext && this.audioContext.state === "running") {
        try {
          const buffer = this.audioContext.createBuffer(1, 1, 22050);
          const source = this.audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioContext.destination);
          source.start(0);
        } catch {}
      }

      // Unlock HTMLAudioElements by playing silently for 1ms
      if (this.preloadedAudio) {
        try {
          this.preloadedAudio.volume = 0;
          const p = this.preloadedAudio.play();
          if (p !== undefined) {
            await p;
            this.preloadedAudio.pause();
            this.preloadedAudio.currentTime = 0;
            this.preloadedAudio.volume = 0.85;
          }
        } catch {}
      }

      if (this.ringingAudio) {
        try {
          this.ringingAudio.volume = 0;
          const p = this.ringingAudio.play();
          if (p !== undefined) {
            await p;
            this.ringingAudio.pause();
            this.ringingAudio.currentTime = 0;
            this.ringingAudio.volume = 0.9;
          }
        } catch {}
      }

      this.audioUnlocked = Boolean(
        (this.audioContext && this.audioContext.state === "running") || this.preloadedAudio || this.ringingAudio
      );
      this.audioBlocked = false;
      this.notify();
      return true;
    } catch (err) {
      console.warn("[SoundManager] Audio unlock deferred until next user interaction:", err);
      this.audioBlocked = true;
      this.notify();
      return false;
    }
  }

  /**
   * Plays synthesized dual-tone notification chime via Web Audio API.
   * Bell 1: E5 (659.25 Hz)
   * Bell 2: A5 (880.00 Hz)
   */
  private async playSynthesizedChime(): Promise<boolean> {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext && AudioCtx) {
        this.audioContext = new AudioCtx();
      }

      if (!this.audioContext) return false;

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      if (this.audioContext.state !== "running") {
        return false;
      }

      const now = this.audioContext.currentTime;

      // Master gain node
      const masterGain = this.audioContext.createGain();
      masterGain.gain.setValueAtTime(0.4, now);
      masterGain.connect(this.audioContext.destination);

      // Bell 1: E5 (659.25 Hz)
      const osc1 = this.audioContext.createOscillator();
      const gain1 = this.audioContext.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.7, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Bell 2: A5 (880.00 Hz) - staggered by 110ms
      const osc2 = this.audioContext.createOscillator();
      const gain2 = this.audioContext.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now + 0.11);
      gain2.gain.setValueAtTime(0, now + 0.11);
      gain2.gain.linearRampToValueAtTime(0.9, now + 0.125);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.11);
      osc2.stop(now + 0.65);

      this.audioUnlocked = true;
      this.audioBlocked = false;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches sound alert. Handles:
   * - Mute preference check
   * - Multi-tab deduplication
   * - Burst throttling
   * - HTML Audio with Web Audio API synthesis fallback
   * - Graceful blocked playback handling (sets audioBlocked to true)
   */
  public async playNotificationSound(eventId?: string): Promise<boolean> {
    if (typeof window === "undefined" || !this.soundEnabled) {
      return false;
    }

    const now = Date.now();

    // 1. Multi-tab deduplication: check if another tab on the same device handled this exact event recently
    if (eventId) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LAST_SOUND);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.id === eventId && now - parsed.time < 5000) {
            // Already handled by another tab
            return false;
          }
        }
      } catch {}
    }

    // 2. Burst grouping: don't overlap chimes if notifications arrive in rapid bursts
    if (now - this.lastPlayedTime < BURST_COOLDOWN_MS) {
      return false;
    }

    // 3. Attempt playback using HTMLAudioElement (notification chime)
    let played = false;
    try {
      const audio = this.preloadedAudio ? (this.preloadedAudio.cloneNode() as HTMLAudioElement) : new Audio("/sounds/notification.mp3");
      audio.volume = 0.75;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        await playPromise;
        played = true;
      }
    } catch (err: any) {
      // If HTML Audio was blocked by mobile browser autoplay policy
      if (err.name === "NotAllowedError") {
        console.warn("[SoundManager] HTML Audio blocked by browser policy. Attempting Web Audio...");
      }
    }

    // 4. Fallback to Web Audio API synthesis
    if (!played) {
      try {
        const synthSuccess = await this.playSynthesizedChime();
        if (synthSuccess) {
          played = true;
        }
      } catch {}
    }

    if (played) {
      this.lastPlayedTime = now;
      this.audioUnlocked = true;
      this.audioBlocked = false;
      this.notify();

      // Mark as played in localStorage & BroadcastChannel for multi-tab deduplication
      if (eventId) {
        try {
          localStorage.setItem(STORAGE_KEY_LAST_SOUND, JSON.stringify({ id: eventId, time: now }));
        } catch {}
      }
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ eventId, timestamp: now });
        } catch {}
      }
      return true;
    } else {
      // Audio playback failed (blocked by browser autoplay policy)
      this.audioBlocked = true;
      this.notify();
      console.warn("[SoundManager] Autoplay blocked by browser policy. User gesture required to enable audio.");
      return false;
    }
  }

  /**
   * User-triggered sound test (always plays regardless of cooldown).
   */
  /**
   * Starts looping incoming ride notification sound/ringing alert for a specific offer.
   * Plays the custom incoming trip sound repeatedly until explicitly accepted or dismissed.
   */
  public async startRinging(offerId: string): Promise<boolean> {
    if (typeof window === "undefined" || !this.soundEnabled) {
      return false;
    }

    // If already ringing for this offer, no need to restart
    if (this.ringingOfferId === offerId && this.ringingAudio && !this.ringingAudio.paused) {
      return true;
    }

    // Stop any existing ringing
    this.stopRinging();

    this.ringingOfferId = offerId;
    this.notify();

    try {
      if (!this.ringingAudio) {
        this.ringingAudio = new Audio("/sounds/incoming-trip.mp3");
        this.ringingAudio.preload = "auto";
      }
      this.ringingAudio.loop = true;
      this.ringingAudio.volume = 0.9;
      this.ringingAudio.currentTime = 0;
      const playPromise = this.ringingAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
        this.audioUnlocked = true;
        this.audioBlocked = false;
        this.notify();
        return true;
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        this.audioBlocked = true;
        this.notify();
        console.warn("[SoundManager] Autoplay blocked for incoming trip ringtone. User gesture required.");
        return false;
      }
    }

    return true;
  }

  /**
   * Immediately stops ringing sound and pauses audio.
   * Called on accept, reject, expiry, cancellation, or withdrawal.
   */
  public stopRinging(offerId?: string): void {
    if (offerId && this.ringingOfferId && this.ringingOfferId !== offerId) {
      // Specified offer does not match currently active ringing offer
      return;
    }

    if (this.ringingInterval) {
      clearInterval(this.ringingInterval);
      this.ringingInterval = null;
    }

    this.ringingOfferId = null;

    if (this.ringingAudio) {
      try {
        this.ringingAudio.pause();
        this.ringingAudio.currentTime = 0;
      } catch {}
    }

    this.notify();
  }

  public async testSound(): Promise<boolean> {
    await this.unlockAudio();
    this.lastPlayedTime = 0; // Reset cooldown for test

    // Try HTML audio first with notification chime
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.75;
      await audio.play();
      this.audioUnlocked = true;
      this.audioBlocked = false;
      this.notify();
      return true;
    } catch {
      // Fallback to synth
      const synthOk = await this.playSynthesizedChime();
      if (synthOk) {
        this.audioUnlocked = true;
        this.audioBlocked = false;
        this.notify();
      }
      return synthOk;
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
