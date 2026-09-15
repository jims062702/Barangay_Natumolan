import { Link } from "react-router-dom";
import type { FamilyMember } from "../../../../shared/types";
import { ageOf, monthYear, memberName } from "./memberFormat";

export function MemberCard({
  member,
  linkTo,
  onRemove,
  onEnd,
}: {
  member: FamilyMember;
  linkTo?: (member: FamilyMember) => string | null;
  onRemove?: (member: FamilyMember) => void;
  /** Guardians only: the arrangement came to an end, rather than being wrong. */
  onEnd?: (member: FamilyMember) => void;
}) {
  const age = ageOf(member);
  const care = member.guardianship ?? null;
  const since = monthYear(care?.started_on);
  const label = member.relationship ?? member.pivot?.relationship ?? null;
  const href = linkTo?.(member) ?? null;

  // Someone who lives outside the barangay is shown as such: their card has
  // no purok or age to show, and the office needs to know at a glance that
  // they have no portal account and are not in the population count.
  const outside = member.record_type === "Non-resident";
  // A parent who has died stays on the card — they are still the parent —
  // but the reader should not have to guess why there is no age beside them.
  const late = member.life_status === "Deceased";

  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-dark">{memberName(member)}</span>
        {outside && (
          <span className="shrink-0 rounded-full bg-gray px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Outside
          </span>
        )}
        {late && (
          <span className="shrink-0 rounded-full bg-dark/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dark">
            Deceased
          </span>
        )}
        {/*
          A child left with a couple has two guardians and one of them is the
          one who answers. Saying which is the difference between reaching
          somebody and leaving a message with whoever is in the house.
        */}
        {care?.is_primary && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Contact
          </span>
        )}
      </span>
      <span className="block text-xs text-gray-500">
        {(outside
          ? [label, member.address, member.contact_number]
          : [label, member.gender, age != null ? `${age} yrs` : null, member.zone_purok]
        )
          .filter(Boolean)
          .join(" · ") || "—"}
      </span>
      {(care?.reason || since) && (
        <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-400">
          {[care?.reason, since ? `since ${since}` : null].filter(Boolean).join(" · ")}
        </span>
      )}
    </>
  );

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray/70 px-3.5 py-2.5">
      <div className="min-w-0">
        {href ? (
          <Link to={href} className="block min-w-0 hover:underline">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {/*
          Two different things, kept apart on purpose. An arrangement that
          ENDED is history worth keeping — who was raising this child in 2026
          is asked years later. One recorded against the wrong person is not
          history, it is a mistake, and it goes.
        */}
        {onEnd && (
          <button
            type="button"
            onClick={() => onEnd(member)}
            className="cursor-pointer rounded-full border border-gray px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:border-primary hover:text-primary"
            title="This arrangement has ended — keep it on the record"
          >
            End
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(member)}
            className="cursor-pointer rounded-full border border-gray px-2.5 py-1 text-[11px] font-semibold text-gray-500 transition-colors hover:border-danger hover:text-danger"
            title="Remove this link — it was recorded in error"
          >
            Unlink
          </button>
        )}
      </span>
    </div>
  );
}
