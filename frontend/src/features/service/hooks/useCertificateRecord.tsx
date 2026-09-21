import { useState } from "react";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { errorMessage } from "../../../shared/lib/api";
import { updateJobBody, enqueue } from "../../../shared/offline/writeQueue";
import { isOffline } from "../../../shared/offline/connectivity";
import { useUpload } from "../../../shared/hooks/useUpload";
import { imageToDataUrl } from "../../../shared/lib/imageData";
import type { Certificate } from "../../../shared/types";
import { serviceApi } from "../api";
import { feeFor } from "../lib/certificateFees";
import { mintLocalNumber, mintReference } from "../lib/certificateNumbers";
import { openPrintView } from "../lib/printView";
import type { CertificateRowsState } from "./useCertificateRows";

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
  /* Whether this type's printed form carries a purpose at all. */
  const asksPurpose = (type: string) =>
    catalogue?.types.find((t) => t.name === type)?.asks_purpose !== false;
  const openDetailEdit = (certificate: Certificate) => {
    setDetailType(certificate.certificate_type);
    setDetailPurpose(certificate.purpose ?? "");
    setEditingDetail(true);
  };
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
      setDetail({ ...detail, ...changes, fee_amount: repriced });
      setEditingDetail(false);
      toast("Corrected on this device. It will be sent when the connection returns.", "info");
      load();

      return;
    }

    try {
      const response = await serviceApi.updateCertificate(detail.id, changes);
      setDetail(response.data.data);
      setEditingDetail(false);
      toast(response.data.message);
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
  type Action = "accept" | "release" | "reprint";
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
    reprint: { title: "Log a reprint for this certificate?", confirmText: "Yes, log reprint" },
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

    /* Accept, release and reprint are all a note that something happened at
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
      setDetail(response.data.data);
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

    /* Nothing to fetch: a certificate still in the queue is not on the server
       yet, and with no line there is nothing to ask. The row is the record. */
    if (certificate.id <= 0 || isOffline()) {
      return;
    }

    try {
      const response = await serviceApi.certificate(certificate.id);
      setDetail(response.data.data);
    } catch {
      // keep the list-row data if the detail fetch fails
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

    return (
      <>
        {c.status === "Pending" && (
          <button type="button" onClick={() => act(c, "accept")} className={primary}>
            Accept &amp; start
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
            <button
              type="button"
              onClick={() => act(c, "reprint")}
              className={quiet}
              title={`Reprints: ${c.reprint_count}`}
            >
              Log reprint
            </button>
          </>
        )}
        {/*
          No cancel. The office decided a filed request is not withdrawn —
          it is worked, or it waits. A certificate already Cancelled keeps
          that status and stays findable; what has gone is the ability to
          put a new one there.
        */}
      </>
    );
  };

  return {
    detail, setDetail, editingDetail, setEditingDetail, detailType, setDetailType,
    detailPurpose, setDetailPurpose, asksPurpose, openDetailEdit, saveDetailEdit, PROMPTS, act,
    photoFile, setPhotoFile, photoUpload, attachPhoto, printAndFinish, openDetail, actionsFor,
  };
}

export type CertificateRecordState = ReturnType<typeof useCertificateRecord>;
