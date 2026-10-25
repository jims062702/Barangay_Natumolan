import { useState, useEffect, type FormEvent } from "react";
import { confirmAction } from "../../../shared/lib/confirm";
import { errorMessage } from "../../../shared/lib/api";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import type { ServiceRequest } from "../../../shared/types";
import { peso } from "../lib/money";
import { portalApi } from "../api";
import type { CertificateService } from "../types";

/** The server's CertificateCatalogue::MAX_IN_TRANSACTION. */
export const MAX_IN_TRANSACTION = 10;

/** One certificate of a request: which, and what for. */
export interface RequestItem {
  key: string;
  serviceType: string;
  purpose: string;
  businessName: string;
  businessKind: string;
  deceasedResidentId?: string;
  deceasedName?: string;
  deceasedAge?: string;
  deceasedAddress?: string;
  dateOfDeath?: string;
  timeOfDeath?: string;
  placeOfDeath?: string;
  relationshipToDeceased?: string;
}

let itemKey = 1;
const newItemKey = () => `r${itemKey++}`;
const blankItem = (serviceType: string): RequestItem => ({
  key: newItemKey(), serviceType, purpose: "", businessName: "", businessKind: "",
  deceasedResidentId: "", deceasedName: "", deceasedAge: "", deceasedAddress: "",
  dateOfDeath: "", timeOfDeath: "", placeOfDeath: "", relationshipToDeceased: "",
});
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The state and handlers of <Requests>, so its sections can share them.
 */
export function usePortalRequests() {
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  const [createOpen, setCreateOpen] = useState(false);
  const [services, setServices] = useState<CertificateService[]>([]);
  /*
   * What is being asked for — one certificate or several, each with its own
   * purpose. Sent together as ONE request, so a resident who needs two
   * papers does not queue twice for them.
   */
  const [items, setItems] = useState<RequestItem[]>([]);
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

  const cancelRequest = async (r: ServiceRequest, reason: string) => {
    if (!reason.trim()) {
      toast("Please provide a reason for cancellation.", "error");
      return;
    }

    setBusyId(r.id);

    try {
      await portalApi.cancelRequest(r.id, { reason_for_cancellation: reason.trim() });
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
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
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
        if (list.length > 0) {
          setItems((was) => (was.length > 0 && was.some((i) => i.serviceType)
            ? was
            : [blankItem(list[0].certificate_type)]));
        }
      })
      .catch(() => setServices([]));
  }, []);

  useAutoRefresh(() => load(), REFRESH.portal);

  const serviceOf = (type: string) => services.find((s) => s.certificate_type === type);

  /*
   * The fee for what the resident has actually chosen, and null
   * until there is enough to say. A clearance priced by purpose has no one
   * fee to quote until a purpose is picked; an answer typed under "Others"
   * is not on the list and takes the ordinance's catch-all, which the
   * office may revise.
   */
  const quoteFee = (item: RequestItem): number | null => {
    const chosen = serviceOf(item.serviceType);
    if (!chosen) return null;
    if (chosen.fee !== null) return chosen.fee;

    const list = chosen.fee_from === "business" ? chosen.business_kinds : chosen.purposes;
    const answer = chosen.fee_from === "business" ? item.businessKind : item.purpose;

    if (!answer.trim()) return null;

    return list && Object.prototype.hasOwnProperty.call(list, answer)
      ? list[answer]
      : chosen.other_fee ?? null;
  };
  const stampOf = (item: RequestItem) => serviceOf(item.serviceType)?.documentary_stamp ?? 0;
  /* The fee and the stamp — or null, not yet known. */
  const quoteTotal = (item: RequestItem): number | null => {
    const fee = quoteFee(item);

    return fee === null ? null : fee + stampOf(item);
  };
  const quotes = items.map(quoteTotal);
  /* The whole request's amount, once every part of it can be said. */
  const grandTotal = quotes.every((q) => q !== null) ? quotes.reduce<number>((sum, q) => sum + (q ?? 0), 0) : null;

  const patchItem = (key: string, patch: Partial<RequestItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const setItemType = (key: string, serviceType: string) =>
    /* The answers belong to the certificate they were given for. */
    patchItem(key, { serviceType, purpose: "", businessName: "", businessKind: "" });
  const addItem = () =>
    setItems((list) => (list.length >= MAX_IN_TRANSACTION ? list : [...list, blankItem(services[0]?.certificate_type ?? "")]));
  const removeItem = (key: string) =>
    setItems((list) => (list.length <= 1 ? list : list.filter((item) => item.key !== key)));

  /* A request being written, kept for this resident until it is submitted. */
  const firstType = services[0]?.certificate_type ?? "";
  const requestDraft = useModalDraft<{ items: RequestItem[] }>(
    "portal-new-request",
    createOpen,
    { items },
    (kept) => {
      /* A draft kept before several could be asked for: one, at the top level. */
      const legacy = kept as unknown as { serviceType?: string; purpose?: string; businessName?: string; businessKind?: string };
      const restored = Array.isArray(kept.items) && kept.items.length > 0
        ? kept.items
        : legacy.serviceType
          ? [{ ...blankItem(legacy.serviceType), purpose: legacy.purpose ?? "", businessName: legacy.businessName ?? "", businessKind: legacy.businessKind ?? "" }]
          : [];
      /* A type the office no longer offers is not put back. */
      const offered = restored.filter((i) => services.length === 0 || services.some((s) => s.certificate_type === i.serviceType));
      if (offered.length > 0) {
        /* Only the fields a certificate has — a draft kept before copies were
           taken off the form may still carry them. */
        setItems(offered.map((i) => ({
          key: i.key || newItemKey(), serviceType: i.serviceType, purpose: i.purpose ?? "",
          businessName: i.businessName ?? "", businessKind: i.businessKind ?? "",
          deceasedResidentId: i.deceasedResidentId ?? "",
          deceasedName: i.deceasedName ?? "",
          deceasedAge: i.deceasedAge ?? "",
          deceasedAddress: i.deceasedAddress ?? "",
          dateOfDeath: i.dateOfDeath ?? "",
          timeOfDeath: i.timeOfDeath ?? "",
          placeOfDeath: i.placeOfDeath ?? "",
          relationshipToDeceased: i.relationshipToDeceased ?? "",
        })));
      }
    },
    {
      isEmpty: (v) => v.items.length <= 1 && v.items.every((i) =>
        (i.serviceType === firstType || !i.serviceType) && !i.purpose && !i.businessName && !i.businessKind && !i.deceasedResidentId),
      reset: () => setItems([blankItem(firstType)]),
    },
  );

  const openCreate = () => {
    if (items.length === 0) setItems([blankItem(firstType)]);
    setCreateOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) return;

    for (const item of items) {
      if (item.serviceType === "Certification of Death") {
        if (!item.deceasedResidentId) {
          toast("Please search and select the deceased resident.", "error");
          return;
        }
        if (!item.relationshipToDeceased?.trim()) {
          toast("Please enter your relationship to the deceased.", "error");
          return;
        }
        if (!item.deceasedAge?.trim()) {
          toast("Please enter the age of the deceased.", "error");
          return;
        }
        if (!item.deceasedAddress?.trim()) {
          toast("Please enter the address of the deceased.", "error");
          return;
        }
        if (!item.dateOfDeath?.trim()) {
          toast("Please select the date of death.", "error");
          return;
        }
        if (!item.timeOfDeath?.trim()) {
          toast("Please enter the time of death.", "error");
          return;
        }
        if (!item.placeOfDeath?.trim()) {
          toast("Please enter the place of death.", "error");
          return;
        }
      }
    }

    const lines = items.map((item, i) => {
      const total = quotes[i];

      return `${item.serviceType}: ` + (total !== null ? peso(total) : "amount confirmed at the counter");
    });

    if (
      !(await confirmAction({
        title: items.length === 1 ? `Request a ${items[0].serviceType}?` : `Request these ${items.length} certificates?`,
        text: lines.join(" · ")
          + (grandTotal !== null && items.length > 1 ? ` — total ${peso(grandTotal)}` : "")
          + (items.some((i) => stampOf(i) > 0) ? " (includes the documentary stamp)." : "."),
        confirmText: "Yes, submit",
      }))
    )
      return;

    setSaving(true);
    try {
      await portalApi.createRequest({
        items: items.map((item) => {
          const chosen = serviceOf(item.serviceType);

          return {
            service_type: item.serviceType,
            purpose: chosen?.asks_purpose === false ? undefined : item.purpose,
            template_fields: item.serviceType === "Certification of Death"
              ? {
                  deceased_resident_id: item.deceasedResidentId,
                  deceased_name: item.deceasedName,
                  deceased_age: item.deceasedAge,
                  deceased_address: item.deceasedAddress,
                  date_of_death: item.dateOfDeath,
                  time_of_death: item.timeOfDeath,
                  place_of_death: item.placeOfDeath,
                  relationship_to_deceased: item.relationshipToDeceased,
                }
              : chosen?.fee_from === "business"
              ? { business_name: item.businessName, business_kind: item.businessKind }
              : undefined,
          };
        }),
      });
      requestDraft.clear();
      setCreateOpen(false);
      setItems([blankItem(firstType)]);
      toast(items.length === 1
        ? "Request submitted! You will be notified as it is processed."
        : `${items.length} certificates requested together! You will be notified as each is processed.`);
      setPage(1);
      load(1);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    pageLoad,
    rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal, loading, setLoading,
    createOpen, setCreateOpen, openCreate, services, setServices, items, setItems, patchItem,
    setItemType, addItem, removeItem, serviceOf, quoteFee, quoteTotal, stampOf, grandTotal, saving,
    setSaving, busyId, setBusyId, canCancel, cancelRequest, resumeRequest, load, submit, requestDraft,
  };
}

export type PortalRequestsState = ReturnType<typeof usePortalRequests>;
