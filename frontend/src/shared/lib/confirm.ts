import Swal from "sweetalert2";

interface ConfirmOptions {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button + warning icon for destructive actions. */
  danger?: boolean;
}

/**
 * Shows a SweetAlert confirmation and resolves true only if the user confirms.
 * Use before any action that changes data:
 *   if (!(await confirmAction({ text: "..." }))) return;
 */
export async function confirmAction(options: ConfirmOptions = {}): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title ?? "Are you sure?",
    text: options.text,
    icon: options.danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Yes, continue",
    cancelButtonText: options.cancelText ?? "Cancel",
    confirmButtonColor: options.danger ? "#DC2626" : "#723EC3",
    cancelButtonColor: "#6B7280",
    reverseButtons: true,
  });
  return result.isConfirmed;
}

interface ReasonOptions {
  title: string;
  text?: string;
  /** What to write, in the box itself. */
  placeholder?: string;
  confirmText?: string;
  danger?: boolean;
  /** Said when the box is left empty. */
  /** The reason may be left blank. */
  optional?: boolean;
  required?: string;
}

/**
 * Confirms an action AND takes the words that go with it.
 *
 * For the handful of actions whose record is worthless without a sentence —
 * a case withdrawn, a case certified to court. Asking "are you sure?" and
 * then writing "Withdrawn" into the register leaves the office with a case
 * nobody can explain a year later. Resolves null when nothing was given.
 */
export async function confirmWithReason(options: ReasonOptions): Promise<string | null> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.danger ? "warning" : "question",
    input: "textarea",
    inputPlaceholder: options.placeholder,
    inputAttributes: { "aria-label": options.placeholder ?? "Reason" },
    /* An optional reason may be left blank; a required one may not. */
    inputValidator: options.optional
      ? undefined
      : (value) => (value.trim() ? undefined : (options.required ?? "Please say why.")),
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "Yes, continue",
    cancelButtonText: "Cancel",
    confirmButtonColor: options.danger ? "#DC2626" : "#723EC3",
    cancelButtonColor: "#6B7280",
    reverseButtons: true,
  });

  return result.isConfirmed ? String(result.value).trim() : null;
}
