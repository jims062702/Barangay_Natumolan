import { FiAlertTriangle, FiPaperclip, FiX } from "react-icons/fi";
import FormField, { inputClasses } from "../../../../shared/ui/FormField";
import FileField from "../../../../shared/ui/FileField";
import {
  COMPLAINT_ACCEPT,
  ID_TYPES,
  MAX_EVIDENCE,
} from "../../../../shared/lib/complaintFiling";
import { ID_TYPE_RULES, validateIdNumber } from "../../../../shared/lib/idValidation";

/**
 * The valid ID, which is required, and the evidence, which is not.
 *
 * THE ID IS WHY THIS FORM CAN EXIST AT ALL. Anything the public can post to
 * can be posted to by a script, and a docket filling with invented disputes
 * would cost the office more than the form saves. A photograph of an
 * identity document is not proof — the officer still holds the card beside
 * the person's face at the counter — but it is a cost a script will not pay.
 *
 * THE EVIDENCE IS OPTIONAL, deliberately and always. Somebody with a
 * photograph of the moved fence should be able to send it. Somebody standing
 * in a corridor with a borrowed phone should not be stopped from reporting
 * anything at all.
 */
export interface IdentityValue {
  idType: string;
  idNumber: string;
  idFile: File | null;
  evidence: File[];
}

export const BLANK_IDENTITY: IdentityValue = {
  idType: "",
  idNumber: "",
  idFile: null,
  evidence: [],
};

const KB = 1024;

function readableSize(bytes: number) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${(bytes / KB).toFixed(0)} KB`;

  return `${(bytes / (KB * KB)).toFixed(1)} MB`;
}

export function IdentityProof({
  value,
  onChange,
  progress = null,
  done = false,
  disabled = false,
  withId = true,
}: {
  value: IdentityValue;
  onChange: (next: IdentityValue) => void;
  progress?: number | null;
  done?: boolean;
  disabled?: boolean;
  /** False for a resident, whose ID is their Barangay Resident ID, uploaded and checked apart. */
  withId?: boolean;
}) {
  const set = <K extends keyof IdentityValue>(key: K, next: IdentityValue[K]) =>
    onChange({ ...value, [key]: next });

  const addEvidence = (picked: File | null) => {
    if (!picked) return;
    set("evidence", [...value.evidence, picked].slice(0, MAX_EVIDENCE));
  };

  const removeEvidence = (index: number) =>
    set("evidence", value.evidence.filter((_, i) => i !== index));

  return (
    <div className="space-y-5">
      {withId && (<>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="What ID will you bring?" required>
          <select
            value={value.idType}
            onChange={(e) => set("idType", e.target.value)}
            className={inputClasses}
            required
            disabled={disabled}
          >
            <option value="">Choose one…</option>
            {ID_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="ID number"
          hint={
            value.idType && ID_TYPE_RULES[value.idType]
              ? ID_TYPE_RULES[value.idType].hint
              : "Optional. Skip it if the card has none you can read."
          }
          error={value.idNumber ? validateIdNumber(value.idType, value.idNumber).error : undefined}
        >
          <input
            value={value.idNumber}
            onChange={(e) => set("idNumber", e.target.value)}
            placeholder={
              value.idType && ID_TYPE_RULES[value.idType]
                ? ID_TYPE_RULES[value.idType].placeholder
                : "Enter ID number"
            }
            className={inputClasses}
            maxLength={
              value.idType && ID_TYPE_RULES[value.idType]?.exactLength
                ? ID_TYPE_RULES[value.idType].exactLength
                : value.idType && ID_TYPE_RULES[value.idType]?.maxLength
                ? ID_TYPE_RULES[value.idType].maxLength
                : 80
            }
            disabled={disabled}
          />
        </FormField>
      </div>

      <FormField
        label="Photograph of that ID"
        required
        plain
        hint="JPG, PNG, WEBP or PDF, up to 5 MB. Bring the same card with you — the office checks it against you at the counter."
      >
        <FileField
          file={value.idFile}
          onPick={(picked) => set("idFile", picked)}
          accept={COMPLAINT_ACCEPT}
          progress={progress}
          done={done}
          disabled={disabled}
        />
      </FormField>

      {/*
        Said plainly, because it is the one thing on this form that people get
        wrong: a photograph is not identification, and somebody who arrives
        without the card cannot be checked and cannot be accepted.
      */}
      <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-3">
        <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-dark">
          The photograph does not identify you on its own. Bring the card itself
          to the Barangay Office — the complaint cannot be accepted without it.
        </p>
      </div>
      </>)}

      <FormField
        label="Anything that shows what happened"
        plain
        hint={`Optional, and it is fine to attach nothing. Photographs, receipts, a letter — up to ${MAX_EVIDENCE} files.`}
      >
        <div className="space-y-2">
          {value.evidence.length < MAX_EVIDENCE && (
            /*
              Remounted after every pick, so the chooser is EMPTY again. The
              browser's own control keeps the last file's name, and with the
              file already listed below it read as a second copy still
              waiting to be added.
            */
            <FileField
              key={value.evidence.length}
              file={null}
              onPick={addEvidence}
              accept={COMPLAINT_ACCEPT}
              disabled={disabled}
            />
          )}

          {value.evidence.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-gray bg-secondary/60 px-3 py-2"
            >
              <FiPaperclip className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-dark">
                {file.name}
              </span>
              <span className="shrink-0 text-[11px] text-gray-500">{readableSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeEvidence(index)}
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                className="shrink-0 cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed"
              >
                <FiX className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}

          {value.evidence.length >= MAX_EVIDENCE && (
            <p className="text-xs text-gray-500">
              That is the most the form takes. Bring anything else with you.
            </p>
          )}
        </div>
      </FormField>
    </div>
  );
}
