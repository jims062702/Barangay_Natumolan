import type { FamilyMember } from "../../../../shared/types";
import { MemberCard } from "./MemberCard";

export function Group({
  title,
  hint,
  members,
  linkTo,
  onRemove,
  onEnd,
  action,
  empty,
}: {
  title: string;
  hint?: string;
  members: FamilyMember[];
  linkTo?: (member: FamilyMember) => string | null;
  onRemove?: (member: FamilyMember) => void;
  onEnd?: (member: FamilyMember) => void;
  action?: React.ReactNode;
  empty: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      {members.length === 0 ? (
        <p className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              linkTo={linkTo}
              onRemove={onRemove}
              onEnd={onEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
