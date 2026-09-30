import { VIOLENCE_ACTS, VIOLENCE_TYPES } from "../../lib/caseOptions";

/**
 * What kind of violence, and — if the desk has it — which acts.
 *
 * ONE CASE IS OFTEN SEVERAL KINDS. A woman describing a beating, the
 * threats that came with it and the wages taken off her had to be filed as
 * one of those from a dropdown, and the desk chose: the other two went
 * unrecorded, the quarterly return under-reported them, and the next
 * officer to open the file read a narrower case than the one that walked
 * in. So the kinds are checkboxes, and any number may be ticked.
 *
 * THE ACTS UNDER A KIND ARE OPTIONAL, and appear only once that kind is
 * ticked. A survivor recounting what happened is not working through a
 * checklist, and an officer who cannot find the exact act on the list must
 * still be able to record the kind — so nothing here is required, and
 * unticking a kind takes its acts away with it.
 */
export function ViolenceChoice({ kinds, acts, onKinds, onActs }: {
  kinds: string[];
  acts: string[];
  onKinds: (next: string[]) => void;
  onActs: (next: string[]) => void;
}) {
  const toggleKind = (kind: string) => {
    if (kinds.includes(kind)) {
      onKinds(kinds.filter((k) => k !== kind));
      /* Its acts go with it: an act left behind on a kind nobody chose is
         a detail the case no longer claims. */
      onActs(acts.filter((a) => !(VIOLENCE_ACTS[kind] ?? []).includes(a)));
      return;
    }
    onKinds([...kinds, kind]);
  };

  const toggleAct = (act: string) =>
    onActs(acts.includes(act) ? acts.filter((a) => a !== act) : [...acts, act]);

  return (
    <fieldset className="rounded-xl border border-gray p-3.5">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Kind of violence <span className="text-danger">*</span>
      </legend>
      <p className="mb-2.5 text-xs text-gray-500">
        Tick every kind that applies. The specific acts underneath are optional.
      </p>

      <div className="space-y-2.5">
        {VIOLENCE_TYPES.map((type) => {
          const on = kinds.includes(type.value);
          return (
            <div key={type.value} className={`rounded-xl border px-3 py-2.5 ${on ? "border-primary/50 bg-primary/5" : "border-gray"}`}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-dark">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleKind(type.value)}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
                {type.label}
              </label>

              {/* Only once the kind is ticked: a wall of thirty acts above
                  any choice at all is a form nobody reads to the end. */}
              {on && (
                <div className="mt-2 grid gap-x-4 gap-y-1.5 pl-7 sm:grid-cols-2">
                  {(VIOLENCE_ACTS[type.value] ?? []).map((act) => (
                    <label key={act} className="flex cursor-pointer items-start gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={acts.includes(act)}
                        onChange={() => toggleAct(act)}
                        className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-primary"
                      />
                      <span>{act}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
