import { useEffect, useState } from "react";
import { useModalDraft } from "../../../../shared/lib/useModalDraft";
import DraftNotice from "../../../../shared/ui/DraftNotice";
import FormField from "../../../../shared/ui/FormField";
import type { Certificate } from "../../../../shared/types";
import { FIELD_HINTS, FIELD_LABELS, fromRegister } from "../../lib/certificateFields";
import { missingKeys } from "../../lib/printReady";
import type { CertificateDeskState } from "../../hooks/useCertificateDesk";
import { TemplateFieldInput } from "./TemplateFieldInput";

/**
 * What this certificate prints beyond the register — filled in on its record.
 *
 * A certificate asked for on the portal or through the chatbot arrives
 * without the office's own lines: the OR number, the kagawad on duty, and on
 * a business clearance often the business itself. Nothing asked for them
 * before printing, so they printed blank. They are asked here, on the
 * record, until the certificate prints — and Print waits on them.
 */
export function PrintDetails({ detail, ctx }: { detail: Certificate; ctx: CertificateDeskState }) {
  const { catalogue, council, saveDetailFields } = ctx;
  const spec = catalogue?.types.find((t) => t.name === detail.certificate_type);
  const keys = spec?.fields ?? [];

  const startFrom = () => ({
    /* What the register knows fills a gap; what was already answered wins —
       an answer saved empty is a gap too, as it is on the paper. */
    ...fromRegister(detail.resident ?? null),
    ...Object.fromEntries(
      Object.entries(detail.template_fields ?? {}).filter(([, v]) => String(v ?? "").trim() !== ""),
    ),
  });

  const [draft, setDraft] = useState<Record<string, string>>(startFrom);
  const [saving, setSaving] = useState(false);

  /* Another certificate opened, or this one saved: start from it. */
  useEffect(() => {
    setDraft(startFrom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id, detail.template_fields, detail.certificate_type]);

  /*
   * Typed and not yet saved, kept per certificate. Once the answers are
   * saved they are the record's, the form equals it again, and the draft
   * goes by itself; a failed save leaves it. What the record held when the
   * form opened is its version — a certificate filled in elsewhere since is
   * not overwritten by old typing.
   */
  const kept = useModalDraft<Record<string, string>>(
    keys.length > 0 ? `certificate-details:${detail.id}` : null,
    true,
    draft,
    (value) => setDraft({ ...startFrom(), ...value }),
    {
      blank: startFrom(),
      reset: () => setDraft(startFrom()),
      version: JSON.stringify(keys.map((key) => String(detail.template_fields?.[key] ?? ""))),
    },
  );

  if (keys.length === 0) return null;

  const missing = missingKeys(detail, spec, draft);
  const changed = keys.some((key) => (draft[key] ?? "") !== String(detail.template_fields?.[key] ?? ""));

  const save = async () => {
    setSaving(true);
    try {
      await saveDetailFields(Object.fromEntries(keys.map((key) => [key, (draft[key] ?? "").trim()])));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray/70 px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Details to print</p>
      {missing.length > 0 ? (
        <p className="mb-3 text-xs font-medium text-danger">
          Printing waits on: {missing.map((key) => FIELD_LABELS[key] ?? key).join(", ")}.
        </p>
      ) : (
        <p className="mb-3 text-xs text-gray-500">Everything this certificate prints is filled in.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((key) => (
          <FormField key={key} label={FIELD_LABELS[key] ?? key} hint={FIELD_HINTS[key]}>
            <TemplateFieldInput
              name={key}
              value={draft[key] ?? ""}
              onChange={(value) => setDraft((was) => ({ ...was, [key]: value }))}
              catalogue={catalogue}
              council={council}
              missing={missing.includes(key)}
            />
          </FormField>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        <DraftNotice draft={kept} />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!changed || saving}
          className="cursor-pointer rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
      </div>
    </div>
  );
}
