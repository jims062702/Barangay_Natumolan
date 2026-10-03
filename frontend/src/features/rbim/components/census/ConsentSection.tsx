import Card from "../../../../shared/ui/Card";
import { Text } from "../fields/Text";
import type { CensusFormState } from "../../hooks/useCensusForm";

/**
 * Consent to the census, and who encoded the form.
 */
export function ConsentSection({ ctx }: { ctx: CensusFormState }) {
  const { form, set } = ctx;

  return (
    <Card title="Consent and encoding">
      <fieldset>
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <label className="inline-flex cursor-pointer items-start gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={Boolean(form.consent_given)}
              onChange={(e) => {
                const checked = e.target.checked;
                set("consent_given", checked);
                if (checked && !form.consent_name && form.respondent_name) {
                  set("consent_name", form.respondent_name);
                }
              }}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
            />
            <span>
              The respondent gave consent to be interviewed and to the use of their data.
              <span className="mt-1 block text-xs leading-relaxed text-gray-600">
                The paper form carries a signature block, and the census may not be used
                without it. A form cannot be submitted until this is recorded.
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Text
            label="Name on the consent"
            maxLength={80}
            hint="Automatically retrieved from Respondent."
            value={(form.consent_name as string) || (form.respondent_name as string) || ""}
            onChange={() => undefined}
            disabled
            preserveValue
          />
          <Text
            label="Date encoded"
            type="date"
            hint="Date encoded (today's date)."
            value={((form.date_encoded as string) || "").slice(0, 10)}
            onChange={() => undefined}
            disabled
            preserveValue
          />
          <Text
            label="Encoder"
            maxLength={80}
            hint="Population worker."
            value={(form.encoder_name as string) ?? ""}
            onChange={() => undefined}
            disabled
            preserveValue
          />
          <Text
            label="Supervisor"
            maxLength={80}
            hint="Population supervisor."
            value={(form.supervisor_name as string) ?? ""}
            onChange={() => undefined}
            disabled
            preserveValue
          />
        </div>
      </fieldset>
    </Card>
  );
}
