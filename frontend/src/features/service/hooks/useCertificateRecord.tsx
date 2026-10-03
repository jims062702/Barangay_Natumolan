import { useState } from "react";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { updateJobBody, enqueue } from "../../../shared/offline/writeQueue";
import { isOffline } from "../../../shared/offline/connectivity";
import { useUpload } from "../../../shared/hooks/useUpload";
import { imageToDataUrl } from "../../../shared/lib/imageData";
import type { Certificate } from "../../../shared/types";
import { serviceApi } from "../api";
import { feeFor } from "../lib/certificateFees";
import { mintLocalNumber, mintReference } from "../lib/certificateNumbers";
import { openPrintView } from "../lib/printView";
import { missingToPrint } from "../lib/printReady";
import type { CertificateRowsState } from "./useCertificateRows";

/**
 * The server's answer laid over what the window already shows.
 *
 * A key MISSING from the answer means "not loaded", not "gone" — Laravel
 * leaves an unloaded relation out entirely, and sends `null` for one that
 * really is empty. Replacing the record wholesale treated the first as the
 * second: attach a photograph and the answer came back without `resident`,
 * so the holder's name, purok and contact went blank until the window was
 * closed and opened again. The server now sends the whole record; this is
 * so that one endpoint forgetting a relation can never blank the window
 * again.
 */
function keepKnown(shown: Certificate | null, answer: Certificate): Certificate {
  if (!shown || shown.id !== answer.id) return answer;

  const merged = { ...shown } as Record<string, unknown>;
  Object.entries(answer).forEach(([key, value]) => {
    if (value !== undefined) merged[key] = value;
  });

  return merged as unknown as Certificate;
}

/**
 * One certificate once it exists: correcting it, and moving it on — accept, photograph, print, release.
 */
export function useCertificateRecord(ctx: CertificateRowsState) {
  const {
    catalogue, council, load,
  } = ctx;

  const [detail, setDetail] = useState<Certificate | null>(null);
  // Correcting a typo in the type or purpose before the document is printed.
  const [editingDetail, setEditingDetail] = useState(false);
  const [detailType, setDetailType] = useState("");
  const [detailPurpose, setDetailPurpose] = useState("");
  /* The other certificates of the same visit, when it asked for several. */
  const [siblings, setSiblings] = useState<Certificate[]>([]);
  /* Whether this type's printed form carries a purpose at all. */
  const asksPurpose = (type: string) =>
    catalogue?.types.find((t) => t.name === type)?.asks_purpose !== false;
  const openDetailEdit = (certificate: Certificate) => {
    setDetailType(certificate.certificate_type);
    setDetailPurpose(certificate.purpose ?? "");
    setEditingDetail(true);
  };
  /* A correction being typed, kept per certificate until it is saved. What
     the certificate said when it was opened is the draft's version. */
  const detailBase = { type: detail?.certificate_type ?? "", purpose: detail?.purpose ?? "" };
  const detailDraft = useModalDraft(
    detail ? `correct-certificate:${detail.id}` : null,
    detail !== null && editingDetail,
    { type: detailType, purpose: detailPurpose },
    (kept) => {
      setDetailType(kept.type ?? detailBase.type);
      setDetailPurpose(kept.purpose ?? "");
    },
    {
      blank: detailBase,
      reset: () => {
        setDetailType(detailBase.type);
        setDetailPurpose(detailBase.purpose);
      },
      version: JSON.stringify(detailBase),
    },
  );
  const saveDetailEdit = async () => {
    if (!detail) return;
    if (
      !(await confirmAction({
        title: "Save these corrections?",
        text: asksPurpose(detailType)
          ? "The certificate type and purpose will be updated."
          : "The certificate type will be updated.",
        confirmText: "Yes, save",
      }))
    )
      return;
    /* The server's own rule: a type that prints a purpose must have one. */
    const purpose = asksPurpose(detailType) ? detailPurpose : null;

    if (asksPurpose(detailType) && !String(purpose ?? "").trim()) {
      toast("Please enter the purpose — it is printed on this certificate.", "error");

      return;
    }

    const changes = { certificate_type: detailType, purpose };
    const jobId = (detail as unknown as { _jobId?: string })._jobId;

    /*
     * A correction is a correction with or without a line.
     *
     * Typing the wrong type or purpose is the commonest thing to get wrong
     * at a counter, and it is caught while the resident is still standing
     * there. Refused offline, the clerk's only way out was to file a second
     * certificate and leave the first one wrong on the register.
     *
     * The fee follows the correction here as it does on the server, so the
     * amount quoted at the counter is the amount that will be recorded:
     * a clearance corrected from "Loan" to "Mayor's Permit" is repriced.
     */
    const repriced = detail.is_exempt
      ? Number(detail.fee_amount)
      : feeFor(catalogue, detailType, purpose ?? "", detail.template_fields ?? {});

    if (jobId) {
      /* Still in the queue: correct the job, so what is sent is right. */
      await updateJobBody(jobId, { ...changes, fee_amount: repriced });
      detailDraft.clear();
      setDetail({ ...detail, ...changes, fee_amount: repriced });
      setEditingDetail(false);
      toast("Corrected on this device. It will be sent as corrected.", "success");
      load();

      return;
    }

    if (isOffline()) {
      await enqueue(
        "put",
        `/certificates/${detail.id}`,
        changes,
        `Correction — ${detail.certificate_number}`,
      );
      detailDraft.clear();
      setDetail({ ...detail, ...changes, fee_amount: repriced });
      setEditingDetail(false);
      toast("Corrected on this device. It will be sent when the connection returns.", "info");
      load();

      return;
    }

    try {
      const response = await serviceApi.updateCertificate(detail.id, changes);
      detailDraft.clear();
      setDetail((shown) => keepKnown(shown, response.data.data));
      setEditingDetail(false);
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  /**
   * The certificate's own lines — OR number, the kagawad on duty, the
   * business — saved onto its record before it prints.
   *
   * With or without a line, as a correction is: the resident is at the
   * counter now, and a certificate that cannot be completed offline is one
   * that cannot be printed offline.
   */
  const saveDetailFields = async (answers: Record<string, string>) => {
    if (!detail) return;

    const template_fields = { ...(detail.template_fields ?? {}), ...answers };
    /* A business clearance is priced by the kind of business — one of these. */
    const repriced = detail.is_exempt
      ? Number(detail.fee_amount)
      : feeFor(catalogue, detail.certificate_type, detail.purpose ?? "", template_fields);
    const jobId = (detail as unknown as { _jobId?: string })._jobId;

    if (jobId) {
      await updateJobBody(jobId, { template_fields, fee_amount: repriced });
      setDetail({ ...detail, template_fields, fee_amount: repriced });
      toast("Saved on this device. It will print as filled in.", "success");
      load();

      return;
    }

    if (isOffline()) {
      await enqueue(
        "put",
        `/certificates/${detail.id}`,
        { template_fields },
        `Details — ${detail.certificate_number}`,
      );
      setDetail({ ...detail, template_fields, fee_amount: repriced });
      toast("Saved on this device. It will be sent when the connection returns.", "info");
      load();

      return;
    }

    try {
      const response = await serviceApi.updateCertificate(detail.id, { template_fields });
      const saved = response.data.data as Certificate;

      /* Only what changed: the reply carries the certificate without the
         people around it, and the record on screen should keep them. */
      setDetail({ ...detail, template_fields: saved.template_fields, fee_amount: saved.fee_amount });
      toast("Details saved. They will print on the certificate.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  /**
   * Every step of the workflow goes through here. Each one is a plain "this
   * happened" confirmation — none of them is a decision about whether the
   * resident may have their certificate.
   */
  type Action = "accept" | "release";
  const PROMPTS: Record<Action, { title: string; text?: string; confirmText: string }> = {
    accept: {
      title: "Start this request?",
      text: "The resident will be told a clerk is preparing their certificate.",
      confirmText: "Yes, start it",
    },
    release: {
      title: "Release this certificate to the resident?",
      text: "Confirm only once they have it in hand.",
      confirmText: "Yes, released",
    },
  };
  const act = async (certificate: Certificate, action: Action) => {
    if (!(await confirmAction(PROMPTS[action]))) return;

    const jobId = (certificate as unknown as { _jobId?: string })._jobId;

    /* A certificate that has not reached the server yet: record the hand-over
       on the job that will create it, with the time it actually happened. */
    if (jobId) {
      if (action === "release") {
        await updateJobBody(jobId, {
          offline_status: "Released",
          released_at: new Date().toISOString(),
        });

        setDetail(null);
        toast("Released to the resident. It will be recorded when the connection returns.", "success");
        load();
      }

      return;
    }

    /* Accept and release are both a note that something happened at
       the counter. None of them needs an answer to be true, so with no line
       they go in the queue rather than failing. */
    if (isOffline() && certificate.id > 0) {
      await enqueue(
        "post",
        `/certificates/${certificate.id}/${action}`,
        {},
        `${action} — ${certificate.certificate_number}`,
      );

      setDetail(null);
      toast("Saved on this device. It will be sent when the connection returns.", "info");
      load();

      return;
    }

    try {
      const response = await serviceApi.certificateStep(certificate.id, action);
      toast(response.data.message);
      setDetail(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  /**
   * Print, and that is the whole middle of the workflow.
   *
   * ASKED, THEN ADVANCED. Pressing Print used to move the certificate to
   * Ready to Claim on the spot, and that is what surfaced the Release button.
   * So a Print pressed by accident — or a printer that jammed, or ran out of
   * paper — left a certificate the system believed was printed and offered to
   * hand over, with no paper anywhere. The barangay decided the clerk confirms
   * the paper is actually in their hand first. Answering "no" changes nothing,
   * and Print is still there to try again.
   */
  /*
   * The counter photograph, for the clearance that carries one.
   *
   * Only the picture: the two thumbmark boxes print empty because a
   * thumbmark is inked onto the paper in front of the clerk. Offering to
   * upload one would be offering to witness something from a distance.
   */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoUpload = useUpload();
  const attachPhoto = async (certificate: Certificate, file: File) => {
    setPhotoFile(file);

    const jobId = (certificate as unknown as { _jobId?: string })._jobId;

    /*
     * With no line — or for a certificate the server has not received yet —
     * the photograph is kept on the device.
     *
     * Shrunk and held as a data URL, which does three jobs at once: it shows
     * in this box, it prints on the certificate, and it is what reaches the
     * server when the queue is sent. The clerk can take the photo, print,
     * and hand the certificate over, all before the internet comes back.
     */
    if (jobId || isOffline()) {
      try {
        const photo = await imageToDataUrl(file);

        if (jobId) {
          await updateJobBody(jobId, { photo_data: photo });
        } else {
          await enqueue(
            "post",
            `/certificates/${certificate.id}/photo-data`,
            { photo_data: photo },
            `Photo — ${certificate.certificate_number}`,
          );
        }

        photoUpload.finish();
        setDetail({ ...certificate, photo_url: photo });
        toast("Photo attached. It will print on the certificate.", "success");
        load(true);
      } catch (err) {
        photoUpload.fail();
        setPhotoFile(null);
        toast(err instanceof Error ? err.message : "The photo could not be attached.", "error");
      }

      return;
    }

    try {
      const form = new FormData();

      form.append("photo", file);

      const response = await serviceApi.uploadCertificatePhoto(
        certificate.id,
        form,
        /* So the bar reports the transfer rather than guessing at it. */
        { ...photoUpload.tracker },
      );

      photoUpload.finish();
      setDetail((shown) => keepKnown(shown, response.data.data));
      toast(response.data.message);
      load(true);
    } catch (err) {
      photoUpload.fail();
      setPhotoFile(null);
      toast(errorMessage(err), "error");
    }
  };
  const printAndFinish = async (certificate: Certificate) => {
    const jobId = (certificate as unknown as { _jobId?: string })._jobId;
    let printable = certificate;

    /*
     * A clearance WITH PICTURE is not printable without the picture.
     *
     * The form has a photo box on it, and a clerk with a queue in front of
     * them can miss it. Printed without one, the paper comes out with an
     * empty frame where the resident's photograph belongs — and nobody
     * notices until it has been signed, stamped and handed over. So the
     * press opens the record at the photo instead of printing, and says
     * why. Once a photo is attached it prints as it always did.
     */
    const spec = catalogue?.types.find((t) => t.name === certificate.certificate_type);

    if (spec?.needs_photo && !certificate.photo_url) {
      openDetail(certificate);
      toast(
        "This certificate prints the resident's photograph. Take it at the counter first, then print.",
        "error",
      );

      return;
    }

    /*
     * Nor without its own lines. A certificate from the portal or the
     * chatbot printed with the OR number, the kagawad on duty and even the
     * business left blank — nothing had asked for them. The press opens the
     * record where they are asked, and says which.
     */
    const missing = missingToPrint(certificate, spec);

    if (missing.length > 0) {
      openDetail(certificate);
      toast(`Fill in before printing: ${missing.join(", ")}. They print on the certificate.`, "error");

      return;
    }

    /*
     * A queued certificate from before device numbering existed has no
     * number and no reference. Printed as it is, the paper would read "—"
     * where both belong: a document the barangay could not stand behind.
     * They are minted now, written into the waiting job, and printed.
     */
    if (jobId && (!certificate.certificate_number || certificate.certificate_number === "—")) {
      const number = await mintLocalNumber();

      if (!number) {
        toast(
          "This device has not received its certificate number series yet. "
          + "Connect once, then try again.",
          "error",
        );

        return;
      }

      const reference = certificate.reference_number || mintReference();

      await updateJobBody(jobId, { certificate_number: number, reference_number: reference });
      printable = { ...certificate, certificate_number: number, reference_number: reference };
    }

    /*
     * The paper comes out first, and it needs no line: buildCertificateHtml
     * runs here, in the browser, from the council roster and fee schedule
     * the device already holds.
     */
    openPrintView(printable, council, catalogue);

    /*
     * Then the clerk says whether it actually printed.
     *
     * Asked in THIS window while the print dialog runs in its own, so the
     * question is waiting when they come back. Nothing moves until they
     * answer yes — see the comment above on why.
     */
    const printed = await confirmAction({
      title: "Did the certificate print correctly?",
      text:
        "Confirm only once the paper is in your hand. The certificate will then "
        + "be ready to release to the resident.",
      confirmText: "Yes, it printed",
      cancelText: "No, not printed",
    });

    if (!printed) {
      toast("Nothing was changed. Press Print again when you are ready.", "info");

      return;
    }

    if (jobId) {
      /*
       * Printed at the counter, with no line. The job waiting to create the
       * certificate is told so, and arrives at the server already printed —
       * stamped with THIS moment rather than whenever the internet returned.
       */
      await updateJobBody(jobId, {
        offline_status: "Ready to Claim",
        printed_at: new Date().toISOString(),
      });

      setDetail(null);
      toast("Printed. It will be saved to the database when the connection returns.", "success");
      load();

      return;
    }

    if (isOffline()) {
      await enqueue(
        "post",
        `/certificates/${certificate.id}/mark-printed`,
        {},
        `Printed — ${certificate.certificate_number}`,
      );

      setDetail(null);
      toast("Printed. It will be recorded when the connection returns.", "info");
      load();

      return;
    }

    try {
      const response = await serviceApi.markCertificatePrinted(certificate.id);
      toast(response.data.message);
      setDetail(null);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  const openDetail = async (certificate: Certificate) => {
    setDetail(certificate); // show list data immediately
    setEditingDetail(false);
    setSiblings([]);

    /* The rest of the visit, when it asked for several — each is its own
       certificate, but the resident is one person at one counter. */
    const code = certificate.service_request?.transaction_code;
    if (code && certificate.id > 0 && !isOffline()) {
      serviceApi.certificates({ params: { transaction_code: code } })
        .then((r) => {
          const others = ((r.data.data.data ?? []) as Certificate[]).filter((c) => c.id !== certificate.id);
          setSiblings(others);
        })
        .catch(() => setSiblings([]));
    }

    /* Nothing to fetch: a certificate still in the queue is not on the server
       yet, and with no line there is nothing to ask. The row is the record. */
    if (certificate.id <= 0 || isOffline()) {
      return;
    }

    try {
      const response = await serviceApi.certificate(certificate.id);
      /*
       * Only onto the window it was fetched FOR.
       *
       * The answer can arrive after the clerk has closed this one, or moved
       * on to another. Laid down regardless, it reopened a closed window by
       * itself, or put the first holder's details under the second
       * certificate's number.
       */
      setDetail((shown) => (shown && shown.id === certificate.id ? keepKnown(shown, response.data.data) : shown));
    } catch {
      // keep the list-row data if the detail fetch fails
    }
  };
  const confirmDeath = async (certificate: Certificate) => {
    const confirmed = await confirmAction({
      title: "Confirm Death of Resident?",
      text: "Confirming death will permanently update the resident's status to Deceased in the official Population register, deactivate their portal account, and end any active marriage records. Are you sure you want to proceed?",
      confirmText: "Yes, Confirm Death",
      cancelText: "Cancel",
    });
    if (!confirmed) return;

    try {
      const response = await serviceApi.confirmDeath(certificate.id);
      toast(response.data.message);
      if (detail && detail.id === certificate.id) {
        setDetail({
          ...detail,
          template_fields: {
            ...detail.template_fields,
            death_confirmed: "1",
            death_confirmed_at: new Date().toISOString(),
          },
        });
      }
      load(true);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const rejectCertificate = async (certificate: Certificate) => {
    const reason = window.prompt("Reject this Certification of Death request? Please state the reason for rejection (this will be sent to the resident):");
    if (reason === null) return;
    if (!reason.trim()) {
      toast("A rejection reason is required.", "error");
      return;
    }

    try {
      const response = await serviceApi.rejectCertificate(certificate.id, { reason: reason.trim() });
      toast(response.data.message);
      setDetail(null);
      load(true);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /** The buttons that make sense for a certificate at its current stage. */
  const actionsFor = (c: Certificate, size: "sm" | "lg") => {
    const base =
      size === "sm"
        ? "cursor-pointer rounded-full px-3 py-1 text-xs font-semibold"
        : "cursor-pointer rounded-full px-6 py-2.5 text-sm font-semibold";
    const primary = `${base} bg-primary text-white hover:bg-primary-dark`;
    const outline = `${base} border border-primary/40 text-primary hover:bg-primary hover:text-white`;
    const success = `${base} bg-success text-white hover:opacity-90`;
    const quiet = `${base} border border-gray text-gray-500 hover:border-primary hover:text-primary`;
    const danger = `${base} border border-danger/40 text-danger hover:bg-danger hover:text-white`;
    const warning = `${base} bg-warning text-white hover:bg-warning-dark`;

    const isDeathCert = c.certificate_type === "Certification of Death";
    const deathConfirmed = Boolean(c.template_fields?.death_confirmed);

    return (
      <>
        {isDeathCert && !deathConfirmed && c.status !== "Cancelled" && (
          <button type="button" onClick={() => confirmDeath(c)} className={warning}>
            Verify &amp; Confirm Death
          </button>
        )}
        {isDeathCert && ["Pending", "Processing"].includes(c.status) && (
          <button type="button" onClick={() => rejectCertificate(c)} className={danger}>
            Reject
          </button>
        )}
        {c.status === "Pending" && (
          <button type="button" onClick={() => act(c, "accept")} className={primary}>
            {isDeathCert ? "Accept & process" : "Accept & start"}
          </button>
        )}
        {c.status === "Processing" && (
          <button type="button" onClick={() => printAndFinish(c)} className={primary}>
            Print
          </button>
        )}
        {c.status === "Ready to Claim" && (
          <>
            <button type="button" onClick={() => openPrintView(c, council, catalogue)} className={quiet}>
              Print again
            </button>
            <button type="button" onClick={() => act(c, "release")} className={success}>
              Release to resident
            </button>
          </>
        )}
        {c.status === "Released" && (
          <>
            <button type="button" onClick={() => openPrintView(c, council, catalogue)} className={outline}>
              Print
            </button>
          </>
        )}
      </>
    );
  };

  return {
    detail, setDetail, editingDetail, setEditingDetail, detailType, setDetailType,
    detailPurpose, setDetailPurpose, asksPurpose, openDetailEdit, saveDetailEdit, PROMPTS, act,
    photoFile, setPhotoFile, photoUpload, attachPhoto, printAndFinish, openDetail, actionsFor,
    saveDetailFields, detailDraft, siblings, confirmDeath, rejectCertificate,
  };
}

export type CertificateRecordState = ReturnType<typeof useCertificateRecord>;
