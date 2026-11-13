// Sound and desktop notifications for incoming messages and calls.

const read = (key, fallback) => {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
};

export const getNotifySettings = () => ({
  sound: read("notify.sound", true),
  desktop: read("notify.desktop", true),
});

export const setNotifySetting = (key, value) => {
  localStorage.setItem(`notify.${key}`, String(value));
};

export const desktopPermission = () =>
  "Notification" in window ? Notification.permission : "unsupported";

export const requestDesktopPermission = async () => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
};

let audioContext;
const getAudioContext = () => {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  audioContext ||= new Ctor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
};

const tone = (context, frequency, start, duration, volume = 0.08) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

export const playMessageSound = () => {
  if (!getNotifySettings().sound) return;
  const context = getAudioContext();
  if (!context) return;
  tone(context, 880, context.currentTime, 0.12);
  tone(context, 1320, context.currentTime + 0.09, 0.18);
};

// Repeating ring until the returned function is called.
export const startRingtone = (incoming) => {
  const context = getAudioContext();
  if (!context) return () => {};

  const ring = () => {
    const now = context.currentTime;
    if (incoming) {
      tone(context, 660, now, 0.25, 0.1);
      tone(context, 880, now + 0.3, 0.25, 0.1);
      tone(context, 660, now + 0.6, 0.25, 0.1);
    } else {
      tone(context, 440, now, 0.9, 0.05);
    }
  };

  ring();
  const timer = setInterval(ring, incoming ? 2000 : 3000);
  return () => clearInterval(timer);
};

export const showDesktopNotification = ({ title, body, icon, tag, onClick }) => {
  if (!getNotifySettings().desktop) return;
  if (desktopPermission() !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: icon || "/favicon.svg",
    });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
};
