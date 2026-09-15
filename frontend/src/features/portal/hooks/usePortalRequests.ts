import { useState, useEffect, type FormEvent } from "react";
import { confirmAction } from "../../../shared/lib/confirm";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import type { ServiceRequest } from "../../../shared/types";
import { peso } from "../lib/money";
import { portalApi } from "../api";
import type { CertificateService } from "../types";

/**
 * The state and handlers of <Requests>, so its sections can share them.
 */
export function usePortalRequests() {
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [services, setServices] = useState<CertificateService[]>([]);
  const [serviceType, setServiceType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessKind, setBusinessKind] = useState("");
  const [saving, setSaving] = useState(false);

  /* The row being cancelled or resumed, so only its own button waits. */
  const [busyId, setBusyId] = useState<number | null>(null);

  /*
   * Whether the barangay has started on this one yet.
   *
   * The DOCUMENT is asked first, because it is the half that knows: a
   * request can still read "Pending" while the clerk has already printed
   * the certificate, and cancelling off the stale half would throw away
   * work already done. This mirrors the same rule on the server, which is
   * the one that actually enforces it — this only decides whether to show
   * a button that would be refused.
   */
  const canCancel = (r: ServiceRequest) =>
    r.status !== "Cancelled" &&
    (r.certificate ? r.certificate.status === "Pending" : r.status === "Pending");

  const cancelRequest = async (r: ServiceRequest) => {
    const ok = await confirmAction({
      title: "Cancel this request?",
      text:
        `${r.certificate?.certificate_type ?? r.service_type} (${r.request_number}) ` +
        "will not be worked on. It stays in your list and you can resume it later.",
      confirmText: "Yes, cancel it",
      cancelText: "Keep it",
    });

    if (!ok) return;

    setBusyId(r.id);

    try {
      await portalApi.cancelRequest(r.id);
      toast("Request cancelled. You can resume it any time.");
      load(page);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const resumeRequest = async (r: ServiceRequest) => {
    setBusyId(r.id);

    try {
      await portalApi.resumeRequest(r.id);
      toast("Request resumed. The barangay will pick it up again.");
      load(page);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const load = (p = page) => {
    setLoading(true);
    portalApi.requests({ params: { page: p } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /*
   * The fees and requirements, fetched once. They come from the office's own
   * schedule and service guide, so what the form quotes is what the counter
   * charges.
   */
  useEffect(() => {
    portalApi.certificateServices()
      .then((r) => {
        const list: CertificateService[] = r.data.data ?? [];
        setServices(list);
        // Pre-selected, as the form always was — but now the choice carries
        // its fee and papers, so the default is a statement rather than a
        // blank the resident has to interpret.
        if (list.length > 0) setServiceType(list[0].certificate_type);
      })
      .catch(() => setServices([]));
  }, []);

  useAutoRefresh(() => load(), REFRESH.portal);

  const chosen = services.find((s) => s.certificate_type === serviceType);

  /*
   * The fee for what the resident has actually chosen, and null until there
   * is enough to say. A clearance priced by purpose has no one fee to quote
   * until a purpose is picked; an answer typed under "Others" is not on the
   * list and takes the ordinance's catch-all, which the office may revise.
   */
  const quotedFee = (() => {
    if (!chosen) return null;
    if (chosen.fee !== null) return chosen.fee;

    const list = chosen.fee_from === "business" ? chosen.business_kinds : chosen.purposes;
    const answer = chosen.fee_from === "business" ? businessKind : purpose;

    if (!answer.trim()) return null;

    return list && Object.prototype.hasOwnProperty.call(list, answer)
      ? list[answer]
      : chosen.other_fee ?? null;
  })();

  const stamp = chosen?.documentary_stamp ?? 0;
  const quotedTotal = quotedFee === null ? null : quotedFee + stamp;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !(await confirmAction({
        title: `Request a ${serviceType}?`,
        text: quotedTotal !== null
          ? `Amount at the counter: ${peso(quotedTotal)}`
            + (stamp > 0 ? ` (includes the ₱${stamp.toFixed(2)} documentary stamp).` : ".")
          : "The office will confirm the amount at the counter.",
        confirmText: "Yes, submit",
      }))
    )
      return;

    setSaving(true);
    try {
      await portalApi.createRequest({
        service_type: serviceType,
        purpose: chosen?.asks_purpose === false ? undefined : purpose,
        /* Only a business clearance asks; the server keeps only these two. */
        template_fields: chosen?.fee_from === "business"
          ? { business_name: businessName, business_kind: businessKind }
          : undefined,
      });
      setCreateOpen(false);
      setPurpose("");
      setBusinessName("");
      setBusinessKind("");
      toast("Request submitted! You will be notified as it is processed.");
      setPage(1);
      load(1);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal, loading, setLoading,
    createOpen, setCreateOpen, services, setServices, serviceType, setServiceType, purpose,
    setPurpose, businessName, setBusinessName, businessKind, setBusinessKind, saving,
    setSaving, busyId, setBusyId, canCancel, cancelRequest, resumeRequest, load, chosen,
    quotedFee, stamp, quotedTotal, submit,
  };
}

export type PortalRequestsState = ReturnType<typeof usePortalRequests>;
