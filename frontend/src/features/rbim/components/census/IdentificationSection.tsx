import { Link } from "react-router-dom";
import Card from "../../../../shared/ui/Card";
import { inputClasses } from "../../../../shared/ui/FormField";
import { Text } from "../fields/Text";
import { Choice } from "../fields/Choice";
import { useZoneNames } from "../../../population/lib/useZones";
import type { CensusFormState } from "../../hooks/useCensusForm";

/**
 * Part A — where the household is, and who heads it.
 */
export function IdentificationSection({ ctx }: { ctx: CensusFormState }) {
  /* The barangay's own zones, kept by the Population Office. */
  const zones = useZoneNames();
  const {
    form, set, setHouseCheck, editing, verifyHouse, status, checking, houseCheck,
    continueHousehold, fillLineOneFrom, filledLines,
  } = ctx;

  return (
    <Card title="A. Identification">
      {/*
        The top of the paper: the form's own number, and which of the two
        boxes is ticked. Both are printed above section A and both were
        missing here — the number was generated and never shown, so a
        clerk holding a numbered sheet had nowhere to put it.
      */}
      <div className="mb-5 grid grid-cols-1 gap-x-5 gap-y-4 border-b border-gray pb-5 sm:grid-cols-2">
        {/*
          One number. It is the form's number on the paper AND the
          household's number here — a barangay writes one sheet per
          house, so two fields asking for it was two chances to
          disagree.

          Checked before anything else is typed: the paper holds ten
          lines, and a household of fifteen comes back on a second
          sheet. That second sheet belongs on the form that already
          exists, not on a new one that nothing joins to it.
        */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-dark">No.</p>
          <div className="flex flex-wrap items-start gap-2">
            <input
              value={(form.census_no as string) ?? ""}
              onChange={(e) => { set("census_no", e.target.value); setHouseCheck(null); }}
             
              placeholder={editing ? "" : "Copy the number on the paper form"}
              aria-label="Form and household number"
              className={`${inputClasses} max-w-xs flex-1`}
            />
            <button
              type="button"
              onClick={verifyHouse}
              /*
                Nothing to verify once the household is registered.
                Verifying asks "is this number free, and who lives
                there?" — and this form is the answer to both. The number
                itself stays editable: a sheet can be filed under the
                wrong one and the correction has to go somewhere.
              */
              disabled={
                status === "Submitted" || checking || !String(form.census_no ?? "").trim()
              }
              className="cursor-pointer rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {checking ? "Checking…" : "Verify"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {status === "Submitted"
              ? "This household is registered, so there is nothing left to check — but the number can still be corrected."
              : editing
                ? "The number on the paper form, and this household's number."
                : "Leave blank and one is issued automatically."}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-dark">This form covers a</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: false, label: "Household" },
              { value: true, label: "Institutional Living Quarters" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
               
                onClick={() => set("is_institutional", option.value)}
                aria-pressed={Boolean(form.is_institutional) === option.value}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                  Boolean(form.is_institutional) === option.value
                    ? "bg-primary text-white"
                    : "bg-secondary text-dark hover:bg-primary/10"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            A dormitory, care home or barracks is counted differently from a family
            household.
          </p>
        </div>

        {houseCheck && !houseCheck.exists && (
          <p className="rounded-xl bg-success/10 px-4 py-2.5 text-xs leading-relaxed text-dark sm:col-span-2">
            Nothing carries that number yet — this will be a new household.
          </p>
        )}

        {houseCheck?.exists && (
          <div className="rounded-xl border border-warning/50 bg-warning/5 p-4 sm:col-span-2">
            {/*
              A form already covering this house is the answer, and the
              only sensible action is to go and stand in it. Everything
              else here is context for deciding whether it really is the
              same house.
            */}
            {houseCheck.census ? (
              <>
                <p className="text-sm font-semibold text-dark">
                  Census {houseCheck.census.census_no} already covers this household
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  {houseCheck.census.members_count} line(s) are on it, headed by{" "}
                  {houseCheck.census.household_head_name} · {houseCheck.census.status}.
                  The paper holds ten — add the rest of the household to that form rather
                  than starting another.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/population/rbim/${houseCheck.census.id}`}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                  >
                    Continue editing {houseCheck.census.census_no} — add the rest there
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setHouseCheck(null); set("census_no", ""); }}
                    className="cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    I typed the wrong number
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-dark">
                  Somebody already lives at {houseCheck.household?.household_number}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  {houseCheck.resident_count} person(s) are recorded there
                  {houseCheck.household?.street_address &&
                    ` · ${houseCheck.household.street_address}`}
                  . No census form covers it yet, so this one will.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={continueHousehold}
                    className="cursor-pointer rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                  >
                    Continue this household — bring their {houseCheck.resident_count} onto
                    the form
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHouseCheck(null); set("census_no", ""); }}
                    className="cursor-pointer rounded-full border border-gray bg-white px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    I typed the wrong number
                  </button>
                </div>
              </>
            )}

            {(houseCheck.residents?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-0.5 text-xs text-gray-600">
                {houseCheck.residents!.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    {r.first_name} {r.last_name}{" "}
                    <span className="text-gray-400">{r.resident_number}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              If the number really is this one and the people do not match, stop here — the
              respondent may have given the wrong number, and that is a question for the next
              visit rather than something to decide at a keyboard.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          Fixed. This is Barangay Natumolan's own register and every
          form in it is taken here — three boxes a clerk could mistype
          and nobody would notice, answering a question that has one
          answer.
        */}
        <Text label="Province" value={form.province as string} onChange={() => undefined} readOnly />
        <Text label="City / Municipality" value={form.city_municipality as string} onChange={() => undefined} readOnly />
        <Text label="Barangay" value={form.barangay as string} onChange={() => undefined} readOnly />
        {/*
          The head is line 1 — that is what Q2 code 01 says — so the
          name typed here IS the first line of the grid. Written through
          rather than asked twice.
        */}
        <Text
          label="Household head"
          maxLength={80}
          required
          hint="Last Name, First Name M.I. — this fills line 1 below."
          value={form.household_head_name as string}
          onChange={(v) => {
            set("household_head_name", v);
            fillLineOneFrom(v);
          }}
        />
        <div>
          <Text
            label="Respondent"
            hint="Last Name, First Name M.I. — automatically fills Name on the consent below."
            maxLength={80}
            value={(form.respondent_name as string) ?? ""}
            onChange={(v) => {
              set("respondent_name", v);
              set("consent_name", v);
            }}
          />
          {Boolean(form.household_head_name) && form.respondent_name !== form.household_head_name && (
            <button
              type="button"
              onClick={() => {
                const head = String(form.household_head_name);
                set("respondent_name", head);
                set("consent_name", head);
              }}
              className="mt-1 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Same as household head ({String(form.household_head_name)})
            </button>
          )}
        </div>
        {/*
          Counted, not typed.

          It used to be what the head said, kept beside the grid so the
          two could be compared. In practice it was a second place to
          get the same number wrong — so it is the grid now, and the
          grid is the thing the office actually holds.
        */}
        <Text
          label="Total members"
          value={filledLines}
          onChange={() => undefined}
          readOnly
          hint="Counted from the lines below."
        />
        {/*
          The head is line 1, so their email is asked there with
          everybody else's — repeating it here would be a second place
          to get one address wrong.
        */}
        {/*
          Not on the paper form, and the register cannot do without it:
          every resident record carries a purok, and submitting this form
          creates resident records.
        */}
        <Choice
          label="Zone / Purok"
          neededToRegister
          hint="Not on the paper form — the register needs one."
          options={zones.map((z) => ({ value: z, label: z }))}
          value={form.zone_purok as string}
          onChange={(v) => set("zone_purok", v)}
        />
        <Text label="Room / Floor / Unit and Building" maxLength={80} value={form.address_unit as string} onChange={(v) => set("address_unit", v)} />
        <Text label="House / Lot and Block No." maxLength={80} value={form.address_house_lot as string} onChange={(v) => set("address_house_lot", v)} />
        <Text label="Street name" maxLength={80} value={form.address_street as string} onChange={(v) => set("address_street", v)} />

      </div>
    </Card>
  );
}
