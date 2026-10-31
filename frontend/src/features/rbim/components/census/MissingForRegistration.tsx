import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import type { CensusFormState } from "../../hooks/useCensusForm";

/**
 * What Submit found missing, at the top where the office is looking.
 */
export function MissingForRegistration({ ctx }: { ctx: CensusFormState }) {
  const { registrationGaps } = ctx;
  const missing = registrationGaps();

  if (missing.length === 0) {
    return (
      <Card className="mb-4 border-emerald-300 bg-emerald-50/70">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          All required fields are filled! You can now preview and register this household.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-danger/40 bg-rose-50/40">
      <p className="flex items-center gap-2 text-sm font-bold text-danger">
        <FiAlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {`${missing.length} required field(s) needed before this household can be registered`}
      </p>

      <ul className="mt-2 space-y-1">
        {missing.map((gap) => (
          <li key={gap} className="flex gap-2 text-xs leading-relaxed text-gray-700">
            <span className="text-danger font-bold">•</span>
            <span>{gap}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-rose-600 font-medium">
        Required fields are highlighted with red borders below. As you fill them in, this list will update automatically.
      </p>
    </Card>
  );
}
