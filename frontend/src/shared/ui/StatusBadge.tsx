const STATUS_TONES: Record<string, string> = {
  /*
    News posts. Draft is deliberately the quietest of the three: it is the
    one state where nothing has reached the public, and a page of loud
    badges makes the one that IS live harder to find.
  */
  Draft: "bg-secondary text-gray-500",
  Published: "bg-success/10 text-success",
  Archived: "bg-gray text-gray-500",
  // Generic / requests
  Pending: "bg-warning/10 text-warning",
  "In Progress": "bg-primary/10 text-primary",
  Approved: "bg-success/10 text-success",
  Completed: "bg-success/10 text-success",
  Rejected: "bg-danger/10 text-danger",
  Cancelled: "bg-gray text-gray-500",
  // Certificates — the counter workflow, in order. `Printed` and
  // `For Signature` are retired stages, kept so historical rows still render.
  Processing: "bg-primary/10 text-primary",
  Printed: "bg-primary/10 text-primary",
  "For Signature": "bg-warning/10 text-warning",
  "Ready to Claim": "bg-success/10 text-success",
  Released: "bg-success/10 text-success",
  // Hearings. "No Show" is spelled the way the hearing enum spells it —
  // the badge used to carry "No-show", which matched nothing, so a hearing
  // nobody attended drew no colour at all.
  Scheduled: "bg-primary/10 text-primary",
  Upcoming: "bg-purple-100 text-purple-700 border border-purple-200",
  Today: "bg-amber-100 text-amber-800 border border-amber-300 font-bold",
  "On-going": "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold",
  "No Show": "bg-danger/10 text-danger",
  // Cases
  Active: "bg-primary/10 text-primary",
  Closed: "bg-gray text-gray-500",
  Filed: "bg-warning/10 text-warning",
  Mediation: "bg-primary/10 text-primary",
  Conciliation: "bg-primary/10 text-primary",
  "Hearing with Punong Barangay": "bg-primary/10 text-primary",
  "Hearing with Lupon": "bg-primary/10 text-primary",
  "For Summons (Punong Barangay)": "bg-warning/10 text-warning",
  "For Summons (Lupon)": "bg-warning/10 text-warning",
  "Amicable Settlement": "bg-success/10 text-success",
  "Repudiated Settlement": "bg-danger/10 text-danger",
  "Certified to File Action": "bg-danger/10 text-danger",
  "Closed (Unpaid)": "bg-gray text-gray-500",
  Settled: "bg-success/10 text-success",
  Dismissed: "bg-gray text-gray-500",
  Referred: "bg-danger/10 text-danger",
  Accepted: "bg-success/10 text-success",
  // Settlements
  "Within Repudiation Period": "bg-warning/10 text-warning",
  Final: "bg-success/10 text-success",
  Repudiated: "bg-danger/10 text-danger",
  Complied: "bg-success/10 text-success",
  "Not Complied": "bg-danger/10 text-danger",
  Executed: "bg-primary/10 text-primary",
  // Health
  Missed: "bg-danger/10 text-danger",
  /* A pregnancy completed by delivery. Active and Closed are shared with
     the cases above. */
  Delivered: "bg-success/10 text-success",
  /* A dose owed by the DOH schedule: within its four weeks, then past them. */
  Due: "bg-warning/10 text-warning",
  Overdue: "bg-danger/10 text-danger",
  Rescheduled: "bg-warning/10 text-warning",
  // Population events
  Verified: "bg-success/10 text-success",
  // Service queue
  Waiting: "bg-warning/10 text-warning",
  Called: "bg-primary/10 text-primary",
  Serving: "bg-success/10 text-success",
  // Referrals
  Acknowledged: "bg-primary/10 text-primary",
  "Not Attended": "bg-danger/10 text-danger",
  // Attendance
  Enrolled: "bg-success/10 text-success",
  Dropped: "bg-danger/10 text-danger",
  Present: "bg-success/10 text-success",
  Absent: "bg-danger/10 text-danger",
  Excused: "bg-warning/10 text-warning",
  // Safety
  Safe: "bg-success/10 text-success",
  "At Risk": "bg-warning/10 text-warning",
  Critical: "bg-danger/10 text-danger",
  "Ongoing concern": "bg-warning/10 text-warning",
  "Immediate danger": "bg-danger/10 text-danger",
  // VAWC — Barangay Protection Orders. "In effect" and "Expired" are what an
  // Issued order is on a given day; the rest are where an application stands.
  "Not Yet Applied": "bg-gray text-gray-500",
  "Application Prepared": "bg-warning/10 text-warning",
  Applied: "bg-primary/10 text-primary",
  Issued: "bg-success/10 text-success",
  "In effect": "bg-success/10 text-success",
  Expired: "bg-gray text-gray-500",
  "Not Issued": "bg-danger/10 text-danger",
  "Referred for TPO/PPO": "bg-primary/10 text-primary",
  // VAWC — referrals
  "Unable to Reach": "bg-danger/10 text-danger",
  "Declined by Client": "bg-gray text-gray-500",
  Immediate: "bg-danger/10 text-danger",
  "Within 24 hours": "bg-warning/10 text-warning",
  Routine: "bg-secondary text-gray-500",
  /* Complaints begun online, and the people waiting on a census.
     "For Office Verification" is WORK WAITING, not a neutral state — grey
     would put it beside Archived and Cancelled on the queue it heads. */
  "For Office Verification": "bg-warning/10 text-warning",
  Registered: "bg-success/10 text-success",
  Declined: "bg-gray text-gray-500",
  Withdrawn: "bg-gray text-gray-500",
  // VAWC — the one dialogue
  "Agreement reached": "bg-success/10 text-success",
  "No agreement": "bg-gray text-gray-500",
};

export default function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "bg-gray text-gray-500";

  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
