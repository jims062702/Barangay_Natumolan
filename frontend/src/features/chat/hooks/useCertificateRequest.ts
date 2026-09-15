import { useState } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { portalApi } from "../../portal/api";
import { nextLineId } from "../lib/widgetIds";
import type { WidgetShellState } from "./useWidgetShell";
import type { LiveDeskState } from "./useLiveDesk";
import type { CertificateService } from "../types";

/**
 * Asking for a certificate from inside the widget.
 */
export function useCertificateRequest(ctx: WidgetShellState & LiveDeskState) {
  const {
    liveStatus, mode, refreshLive, setMessages, token,
  } = ctx;

  /*
   * Requesting a certificate without leaving the chat.
   *
   * The assistant could already say what a clearance needs and what it
   * costs — and then the resident had to go and find the form themselves,
   * which is the point at which most of them stop. It is the same request
   * whichever door it comes through: same record, same pending certificate,
   * same clerk.
   */
  const [services, setServices] = useState<CertificateService[]>([]);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<CertificateService | null>(null);
  const [purpose, setPurpose] = useState("");
  const [filing, setFiling] = useState(false);
  /** What the office issues, fetched when the resident asks to request one. */
  const openRequest = async () => {
    setPicking(true);
    setChosen(null);
    setPurpose("");

    if (services.length === 0) {
      try {
        const response = await portalApi.certificateServices();
        setServices(response.data.data ?? []);
      } catch {
        setServices([]);
      }
    }
  };
  /**
   * Files it.
   *
   * The portal's own endpoint, not a second one written for the chat —
   * so the request lands in My Requests, raises the same pending
   * certificate, and reaches the same clerk's worklist. The token goes with
   * it only when a Secretary is actually on the conversation, so they see
   * what was asked for while they are still helping.
   */
  const fileRequest = async () => {
    if (!chosen || !purpose.trim()) return;

    setFiling(true);

    try {
      const response = await portalApi.createRequest({
        service_type: chosen.certificate_type,
        purpose: purpose.trim(),
        ...(mode === "live" && token && liveStatus !== "Closed"
          ? { session_token: token }
          : {}),
      });

      const number = response.data.data?.request_number ?? "";

      setMessages((prev) => [
        ...prev,
        {
          id: nextLineId(),
          from: "bot",
          text:
            `Your request for a ${chosen.certificate_type} is in — ${number}. ` +
            `It is now under My Requests, and the office will start on it.` +
            (chosen.requirements.length
              ? `\n\nBring with you:\n${chosen.requirements.map((r) => `• ${r}`).join("\n")}`
              : "") +
            (chosen.fee > 0 ? `\n\nFee: P${chosen.fee.toFixed(2)}` : ""),
        },
      ]);

      if (mode === "live" && token) void refreshLive(token);

      setPicking(false);
      setChosen(null);
      setPurpose("");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextLineId(), from: "bot" as const, text: errorMessage(err) },
      ]);
    } finally {
      setFiling(false);
    }
  };

  return {
    services, setServices, picking, setPicking, chosen, setChosen, purpose, setPurpose, filing,
    setFiling, openRequest, fileRequest,
  };
}

export type CertificateRequestState = ReturnType<typeof useCertificateRequest>;
