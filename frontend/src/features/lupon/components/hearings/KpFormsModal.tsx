import { useEffect, useMemo, useRef, useState } from "react";
import { FiInfo } from "react-icons/fi";
import Modal from "../../../../shared/ui/Modal";
import FormPreview, { type FormPreviewHandle } from "../../../../shared/print/FormPreview";
import { SignatoryFields, useSignatories } from "../../../../shared/print/SignatoryFields";
import { withoutHon } from "../../../../shared/print/formKit";
import { asDate } from "../../lib/hearings";
import { kpFormsHtml } from "../../lib/kpForms";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/** The notice of hearing and the summons: the two papers one sitting calls for. */
const HEARING_PAPERS = ["KP-7", "KP-9"];

/**
 * The prescribed KP forms this hearing's case can produce — as paper.
 *
 * Every Print button here used to call window.print(), which printed the
 * dashboard behind the dialog. "Print the summons" told both parties a
 * hearing had been called and produced nothing anybody could hand them.
 * Now each form is a document of its own, drawn from the case, shown as it
 * will print and printed from the same frame.
 *
 * SEVERAL AT ONCE (2026-09-29): the notice of hearing (for the complainant)
 * and the summons (for the respondent) are chosen together and print as one
 * job, each on its own page.
 *
 * AND ASKED AFTERWARDS: when the papers are the first of their kind, closing
 * the print dialog asks whether they came out — only a yes marks them
 * Printed, tells the parties, and books the sittings (see afterPrint).
 */
export function KpFormsModal({ ctx }: { ctx: HearingCalendarState }) {
  const { formsFor, forms, awaitingPrint, afterPrint, closeForms } = ctx;
  const preview = useRef<FormPreviewHandle>(null);

  /* Which forms are on the table: the two papers a sitting calls for. */
  const [codes, setCodes] = useState<string[]>(HEARING_PAPERS);

  /*
   * A new case's papers are drawn from the sitting they WILL book — it is
   * not on the case yet, so the server lists them as waiting on one.
   */
  const planned = awaitingPrint?.kind === "case";
  const isAvailable = (form: { code: string; available: boolean }) =>
    form.available || (planned && HEARING_PAPERS.includes(form.code));
  const available = (forms?.forms ?? []).filter(isAvailable);

  useEffect(() => {
    if (!forms) return;
    const ready = forms.forms.filter(isAvailable).map((f) => f.code);
    setCodes((was) => {
      const kept = was.filter((c) => ready.includes(c));
      if (kept.length) return kept;
      /* Reopened on a case with no summons to give: fall to what it has. */
      const papers = HEARING_PAPERS.filter((c) => ready.includes(c));
      return papers.length ? papers : ready.slice(0, 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, planned]);

  /* In the form list's own order, whatever order they were chosen in. */
  const chosen = (forms?.forms ?? []).map((f) => f.code).filter((c) => codes.includes(c));
  const toggle = (code: string) =>
    setCodes((was) => (was.includes(code) ? was.filter((c) => c !== code) : [...was, code]));

  const s = forms?.signatories ?? {};
  const signatoryDefaults = [
    { key: "punong_barangay", label: "Punong Barangay/Lupon Chairman", value: withoutHon(s.punong_barangay) },
    { key: "secretary", label: "Lupon Secretary", value: s.secretary ?? "" },
  ];
  const signatories = useSignatories(signatoryDefaults);

  const html = useMemo(
    () =>
      kpFormsHtml(
        chosen,
        forms,
        {
          punong_barangay: signatories.names.punong_barangay ?? "",
          secretary: signatories.names.secretary ?? "",
        },
        formsFor,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    /* By value: the list behind this dialog refreshes on a timer, and a new
       object holding the same case must not reload a sheet mid-print. */
    [chosen.join(","), JSON.stringify(forms ?? null), JSON.stringify(formsFor ?? null), JSON.stringify(signatories.names)],
  );

  return (
    <Modal
      open={formsFor !== null}
      onClose={closeForms}
      wide
      title={`KP Forms — ${formsFor?.lupon_case?.case_number ?? ""}`}
    >
      {!forms ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading case facts…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary px-4 py-3 text-sm">
            <p className="font-semibold text-dark">{forms.case.case_title}</p>
            <p className="mt-1 text-xs text-gray-500">
              {forms.barangay.name}, {forms.barangay.municipality},{" "}
              {forms.barangay.province} · Filed {asDate(forms.case.date_filed)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {forms.case.complainant_display_name ?? "—"}{" "}
              vs.{" "}
              {forms.case.respondent_display_names || "—"}
            </p>
          </div>

          {/* Nothing is recorded until the office says the papers came out. */}
          {awaitingPrint && (
            <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3" data-testid="print-not-recorded">
              <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-gray-700">
                {planned ? (
                  <>
                    Not booked yet. The papers name the first sitting —{" "}
                    <strong className="text-dark">
                      {formsFor?.scheduled_at
                        ? new Date(`${formsFor.scheduled_at.slice(0, 19)}`).toLocaleString("en-PH", { dateStyle: "full", timeStyle: "short" })
                        : "—"}
                    </strong>
                    . After printing you will be asked whether they came out: only then are the sittings booked, the
                    case marked <strong>Printed</strong>, and both parties told.
                  </>
                ) : (
                  <>
                    After printing you will be asked whether the papers came out: only then is the summons marked{" "}
                    <strong>Printed</strong> and the parties told.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Which forms, then the forms. A case that cannot produce one says
              what it is still missing, in the same place. */}
          <ul className="divide-y divide-gray/70">
            {forms.forms.map((form) => {
              const ready = isAvailable(form);
              const on = codes.includes(form.code);

              return (
                <li key={form.code} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dark">
                      <span className="font-mono text-primary">{form.code}</span> — {form.name}
                    </p>
                    {!ready && (
                      <p className="mt-0.5 text-xs text-gray-400">Needs {form.requires}.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    aria-pressed={on}
                    onClick={() => toggle(form.code)}
                    className={`shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:border-gray disabled:text-gray-400 disabled:hover:bg-transparent ${
                      on
                        ? "border-primary bg-primary text-white"
                        : "border-primary/40 text-primary hover:bg-primary hover:text-white"
                    }`}
                  >
                    {on ? "Selected" : "Choose"}
                  </button>
                </li>
              );
            })}
          </ul>

          {available.length > 0 && (
            <>
              <SignatoryFields defaults={signatoryDefaults} state={signatories} />
              <FormPreview
                ref={preview}
                html={html}
                title={`KP forms ${chosen.join(" + ")}`}
                printLabel={chosen.length ? `Print ${chosen.join(" + ")}` : "Choose a form"}
                disabled={!html}
                onPrinted={() => void afterPrint()}
              />
            </>
          )}

          <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
            Forms follow the DILG Katarungang Pambarangay handbook. A form
            becomes printable once the case holds the facts it requires.
            Choose more than one to print them together, each on its own page.
          </p>
        </div>
      )}
    </Modal>
  );
}
