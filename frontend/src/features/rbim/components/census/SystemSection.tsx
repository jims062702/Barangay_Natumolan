import FormField from "../../../../shared/ui/FormField";
import PhoneInput from "../../../../shared/ui/PhoneInput";
import { Section } from "../Section";
import { progressOf } from "../../lib/rules";
import { EmailField } from "../fields/EmailField";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Member } from "../../types";

/**
 * What the register needs that the paper form does not ask.
 */
export function SystemSection({ ctx, member, index }: {
  ctx: CensusFormState;
  member: Member;
  index: number;
}) {
  const { setMember, id, matches, clashingLine } = ctx;

  return (
    <Section
      title="For the system"
      note="not on the paper form"
      openByDefault
      progress={progressOf(["email", "contact_number"], member)}
    >
      <EmailField
        value={member.email}
        onChange={(v) => setMember(index, "email", v)}
        censusId={id}
        residentId={matches[index]?.id ?? null}
        clashLine={clashingLine(index)}
       
      />
      {/*
        Not checked for duplicates, deliberately. A household
        shares one phone all the time, nothing is issued
        against it, and a warning that is usually wrong is a
        warning the office learns to click past.
      */}
      {/*
        One shape for a mobile number, because three arrive.
        0917…, +63917… and 917… are the same phone, and a clerk
        searching for one of them finds only the third of the
        register that happens to be written their way.
      */}
      <FormField
        label="Contact Number"
        hint="Ten digits after +63. It may be shared with the household."
      >
        <PhoneInput
          value={String(member.contact_number ?? "")}
          onChange={(v) => setMember(index, "contact_number", v)}
        />
      </FormField>
    </Section>
  );
}
