import { FiAlertTriangle } from "react-icons/fi";
import Card from "../../../../shared/ui/Card";
import type { CensusFormState } from "../../hooks/useCensusForm";

/**
 * What Submit found missing, at the top where the office is looking.
 */
export function MissingForRegistration({ ctx }: { ctx: CensusFormState }) {
  const { registrationGaps } = ctx;

  return (
    <Card className="mb-4 border-danger/40">
      <p className="flex items-center gap-2 text-sm font-bold text-danger">
        <FiAlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {registrationGaps().length === 0
          ? "All set — press Submit again."
          : `${registrationGaps().length} thing(s) needed before this household can be registered`}
      </p>

      {registrationGaps().length > 0 && (
        <>
          <ul className="mt-2 space-y-1">
            {registrationGaps().map((gap) => (
              <li key={gap} className="flex gap-2 text-xs leading-relaxed text-gray-700">
                <span className="text-danger">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            The boxes are starred on the form. Fill them in, then press Preview form
            again.
          </p>
        </>
      )}
    </Card>
  );
}
