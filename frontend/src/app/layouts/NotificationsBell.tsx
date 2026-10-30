import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiChevronRight, FiVolumeX, FiVolume2 } from "react-icons/fi";
import { useSoundMuted } from "../../shared/hooks/useSoundMuted";
import { notificationPermission, ensureNotifyPermission, showDesktopNotification, notificationsSupported } from "../../shared/lib/desktopNotify";
import { playNotificationSound } from "../../shared/lib/sound";
import { useAutoRefresh, REFRESH } from "../../shared/hooks/useAutoRefresh";
import { useAuth } from "../../shared/auth/AuthContext";
import type { AppNotification } from "../../shared/types";
import { accountApi } from "../../features/account/api";

function resolveNotificationUrl(n: AppNotification, role?: string): string {
  const isResident = role?.toLowerCase() === "resident";
  const type = (n.notification_type ?? "").toLowerCase();
  const entity = (n.related_entity_type ?? "").toLowerCase();
  const sub = (n.subject ?? "").toLowerCase();
  const msg = (n.message ?? "").toLowerCase();
  const combined = `${type} ${entity} ${sub} ${msg}`;

  // If a link is provided in notification
  if (n.link && n.link.trim() !== "") {
    const rawLink = n.link.trim();
    if (isResident) {
      if (rawLink.startsWith("/services") || rawLink.startsWith("/certificates")) {
        return "/resident/requests";
      }
      if (rawLink.startsWith("/appointments")) {
        return "/resident/appointments";
      }
      if (rawLink.startsWith("/lupon")) {
        return "/resident/lupon/complaints";
      }
      if (rawLink.startsWith("/vawc")) {
        return "/resident/vawc/reports";
      }
      if (rawLink.startsWith("/content/announcements") || rawLink.startsWith("/sk/announcements")) {
        return "/resident/announcements";
      }
      return rawLink;
    }
    // For staff (clerk, secretary, PB, admin, etc.)
    if (rawLink.startsWith("/resident/requests")) {
      return "/services";
    }
    if (rawLink.startsWith("/resident/appointments")) {
      return "/appointments";
    }
    if (rawLink.startsWith("/resident/announcements")) {
      return "/content/announcements";
    }
    return rawLink;
  }

  // Fallbacks based on notification type, entity, and text
  if (
    combined.includes("cert") ||
    combined.includes("clearance") ||
    combined.includes("indigency") ||
    combined.includes("residency") ||
    combined.includes("request") ||
    combined.includes("claim") ||
    combined.includes("document")
  ) {
    return isResident ? "/resident/requests" : "/services";
  }

  if (
    combined.includes("appointment") ||
    combined.includes("booking") ||
    combined.includes("punong barangay")
  ) {
    return isResident ? "/resident/appointments" : "/appointments";
  }

  if (
    combined.includes("announcement") ||
    combined.includes("news") ||
    combined.includes("event") ||
    combined.includes("advisory") ||
    combined.includes("program")
  ) {
    return isResident ? "/resident/announcements" : "/content/announcements";
  }

  if (
    combined.includes("complaint") ||
    combined.includes("lupon") ||
    combined.includes("hearing") ||
    combined.includes("amicable") ||
    combined.includes("summon")
  ) {
    return isResident ? "/resident/lupon/complaints" : "/lupon/complaints";
  }

  if (
    combined.includes("vawc") ||
    combined.includes("protection order") ||
    combined.includes("bpo")
  ) {
    return isResident ? "/resident/vawc/reports" : "/vawc/online-reports";
  }

  if (
    combined.includes("health") ||
    combined.includes("immuniz") ||
    combined.includes("vaccin") ||
    combined.includes("prenatal") ||
    combined.includes("maternal") ||
    combined.includes("patient")
  ) {
    return isResident ? "/resident/health" : "/health/visits";
  }

  if (combined.includes("chat")) {
    return isResident ? "/resident" : (n.related_entity_id ? `/chat?id=${n.related_entity_id}` : "/chat");
  }

  return isResident ? "/resident" : "/dashboard";
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [muted, toggleMuted] = useSoundMuted();
  const [perm, setPerm] = useState<NotificationPermission>(notificationPermission());
  // -1 = not loaded yet, so the first fetch never rings.
  const prevUnread = useRef(-1);

  const enableAlerts = async () => {
    await ensureNotifyPermission();
    setPerm(notificationPermission());
  };

  const load = async () => {
    try {
      const response = await accountApi.notifications();
      const nextUnread = response.data.data.unread_count as number;
      const list: AppNotification[] = response.data.data.notifications.data ?? [];
      // Alert only when the count goes up (a new notification arrived) —
      // never on the initial load or when marking things read.
      if (prevUnread.current >= 0 && nextUnread > prevUnread.current) {
        playNotificationSound();
        const newest = list.find((n) => !n.is_read) ?? list[0];
        if (newest) {
          // Desktop popup — shows even if the tab is in the background.
          showDesktopNotification(newest.subject, newest.message, `bn-notif-${newest.id}`);
        }
      }
      prevUnread.current = nextUnread;
      setUnread(nextUnread);
      setItems(list);
    } catch {
      // Non-critical; leave the bell empty.
    }
  };

  useEffect(() => {
    load();
    // Ask for desktop-notification permission on the first click/keypress
    // (browsers require a user gesture). Only prompts once, ever.
    const ask = () => ensureNotifyPermission();
    window.addEventListener("pointerdown", ask, { once: true });
    window.addEventListener("keydown", ask, { once: true });
    return () => {
      window.removeEventListener("pointerdown", ask);
      window.removeEventListener("keydown", ask);
    };
  }, []);

  // Live updates: new notifications appear (and ring) without a refresh.
  // `evenWhenHidden` keeps polling while the user is on another tab so the
  // sound and desktop alert still fire.
  useAutoRefresh(load, REFRESH.staff, { evenWhenHidden: true });

  /*
   * Pressing a notice opens what it is about, and marks it read.
   *
   * Marked on the screen first and on the server after: the page it opens
   * should not wait on a round trip, and if that trip fails the next poll
   * simply shows the notice as unread again — nothing is lost.
   */
  const openNotice = (n: AppNotification) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      prevUnread.current = Math.max(0, prevUnread.current - 1);
      accountApi.markNotificationRead(n.id).catch(() => undefined);
    }

    const targetLink = resolveNotificationUrl(n, user?.role);
    setOpen(false);
    if (targetLink) {
      navigate(targetLink);
    }
  };

  const markAllRead = async () => {
    await accountApi.markAllNotificationsRead();
    prevUnread.current = 0;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <FiBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        /*
         * On a phone the panel is anchored to the VIEWPORT, not to the bell.
         * A 320px panel hung off `right-0` from a bell that sits 208px in
         * reaches x = -112 — a third of every message was cut off past the
         * left edge with no way to scroll to it.
         */
        <div className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-2xl border border-gray bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between border-b border-gray px-4 py-3">
            <p className="text-sm font-semibold text-dark">Notifications</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMuted}
                aria-label={muted ? "Turn notification sound on" : "Turn notification sound off"}
                title={muted ? "Sound off — click to turn on" : "Sound on — click to mute"}
                className="cursor-pointer text-gray-400 transition-colors hover:text-primary"
              >
                {muted ? <FiVolumeX className="h-4 w-4" /> : <FiVolume2 className="h-4 w-4" />}
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="cursor-pointer text-xs font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Prompt to turn on Chrome desktop popups (once, per browser). */}
          {notificationsSupported() && perm === "default" && (
            <button
              type="button"
              onClick={enableAlerts}
              className="flex w-full items-center gap-2 border-b border-gray bg-primary/5 px-4 py-2.5 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <FiBell className="h-4 w-4 shrink-0" />
              Enable desktop alerts so you get notified on another tab
            </button>
          )}
          {notificationsSupported() && perm === "denied" && (
            <p className="border-b border-gray bg-warning/10 px-4 py-2.5 text-xs text-dark">
              Desktop alerts are blocked. To enable, click the lock/⚙ icon in
              your browser's address bar → Notifications → Allow.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                No notifications yet.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotice(n)}
                className={`group flex w-full cursor-pointer items-start gap-2 border-b border-gray/60 px-4 py-3 text-left transition-colors hover:bg-primary/10 ${
                  n.is_read ? "" : "bg-primary/5"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-dark group-hover:text-primary transition-colors">
                    {n.subject}
                  </span>
                  {/* In full: the hearing date is often the last words. */}
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {n.message}
                  </span>
                </span>
                <FiChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 group-hover:text-primary transition-colors"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
