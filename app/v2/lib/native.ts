// Native-shell (Capacitor) integrations. Every function is a no-op on the
// website: NEXT_PUBLIC_APP_MODE is inlined at build time, so the web bundle
// drops these code paths (and the plugin imports) entirely. Failures are
// swallowed -- a haptic or notification must never break the app.
export const isNativeApp = process.env.NEXT_PUBLIC_APP_MODE === "native";

const REMINDER_ID = 1001;

// One standing reminder for the next time words come due, replaced on every
// progress refresh (app open, each graded answer). Local notifications only:
// scheduled on-device, no push infrastructure.
export async function scheduleReviewReminder(nextDueAt: string | null): Promise<void> {
  if (!isNativeApp) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return;

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.some((n) => n.id === REMINDER_ID)) {
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    }

    if (!nextDueAt) return;
    const at = new Date(nextDueAt);
    // Already due means the user is looking at the app right now.
    if (at.getTime() <= Date.now()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: "Yalla Flash",
          body: "You have words ready to review -- yalla!",
          schedule: { at, allowWhileIdle: true },
        },
      ],
    });
  } catch {
    // Plugin missing (web preview of the native build) or permission quirks.
  }
}

// The splash stays up (launchAutoHide: false) until an entry screen -- chat,
// gate notice, landing -- is actually on-glass and calls this. NativeInit
// backstops it with a timer so a stuck boot can never strand the splash.
export async function hideSplash(): Promise<void> {
  if (!isNativeApp) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // Splash plugin is iOS/Android only.
  }
}

// Light tick on primary UI actions (chips, send). Native buttons feel
// physical; a silent tap is the biggest webview tell.
export async function tapHaptic(): Promise<void> {
  if (!isNativeApp) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Devices without a haptic engine.
  }
}

// Success/error tap on a graded answer.
export async function reviewHaptic(correct: boolean): Promise<void> {
  if (!isNativeApp) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({
      type: correct ? NotificationType.Success : NotificationType.Error,
    });
  } catch {
    // Devices without a haptic engine.
  }
}
