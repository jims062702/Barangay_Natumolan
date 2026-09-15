import Modal from "../../../../shared/ui/Modal";
import { asDate } from "../../lib/hearings";
import type { HearingCalendarState } from "../../hooks/useHearingCalendar";

/**
 * The prescribed KP forms this hearing's case can produce.
 */
export function KpFormsModal({ ctx }: { ctx: HearingCalendarState }) {
  const { formsFor, setFormsFor, forms } = ctx;

  return (
    <Modal
      open={formsFor !== null}
      onClose={() => setFormsFor(null)}
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

          <ul className="divide-y divide-gray/70">
            {forms.forms.map((form) => (
              <li key={form.code} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dark">
                    <span className="font-mono text-primary">{form.code}</span> — {form.name}
                  </p>
                  {!form.available && (
                    <p className="mt-0.5 text-xs text-gray-400">Needs {form.requires}.</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!form.available}
                  onClick={() => window.print()}
                  className="shrink-0 cursor-pointer rounded-full border border-primary/40 px-4 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-gray disabled:text-gray-400 disabled:hover:bg-transparent"
                >
                  Print
                </button>
              </li>
            ))}
          </ul>

          <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-gray-500">
            Forms follow the DILG Katarungang Pambarangay handbook. A form
            becomes printable once the case holds the facts it requires.
          </p>
        </div>
      )}
    </Modal>
  );
}
