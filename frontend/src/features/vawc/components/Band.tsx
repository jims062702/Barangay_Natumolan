/**
 * One band of the intake form.
 *
 * The form is long because the law asks a lot at one desk. Three headings
 * make it three shorter forms: who this is about, what happened and how
 * dangerous it is now, and what the office is keeping. Without them it is
 * twenty boxes in a column and the officer loses their place mid-interview.
 */
/** A question answered with buttons, marked required the way FormField marks one. */
export function RequiredQuestion({ text, required = true }: { text: string; required?: boolean }) {
  return (
    <p className="mb-1.5 text-sm font-medium text-dark">
      {text}
      {required && <span className="text-danger"> *</span>}
    </p>
  );
}

export function Band({ title, hint, children }: {
  title: string;
  hint?: string;
  /** A band may be a heading on its own; the fields that follow are siblings. */
  children?: React.ReactNode;
}) {
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="mb-2 border-b border-gray pb-1.5">
        <p className="text-sm font-bold text-dark">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      {children && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </div>
  );
}
