import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertCircle,
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiFileText,
  FiFolder,
  FiHeart,
  FiHome,
  FiImage,
  FiLayers,
  FiMap,
  FiMapPin,
  FiMessageCircle,
  FiSettings,
  FiShield,
  FiSmile,
  FiUser,
  FiUserPlus,
  FiUserX,
  FiUsers,
} from "react-icons/fi";
import type { User } from "../types";

export interface MenuItem {
  label: string;
  to: string;
  icon: IconType;
  /**
   * Entries that open under this one.
   *
   * For a page that carries two different pieces of news — "My cases" is
   * what I filed AND what was filed against me — where one badge could not
   * say which. The parent stays clickable; the children each carry their
   * own count.
   */
  children?: MenuItem[];
}

export interface MenuSection {
  heading?: string;
  items: MenuItem[];
}

/** Sidebar menu, filtered by the account's role/office (mirrors the API gates). */
export function menuFor(user: User): MenuSection[] {
  if (user.role === "Resident") {
    return [
      {
        items: [
          { label: "My Dashboard", to: "/resident", icon: FiHome },
          /*
           * One entry, not two. "My Requests" and "My Certificates" listed
           * the same event twice — the asking and the document that came
           * out of it — and the two pages disagreed about its status.
           */
          { label: "My Request Certificates", to: "/resident/requests", icon: FiAward },
          /*
           * Their Katarungang Pambarangay record — never VAWC, see
           * Portal\CaseController for why.
           *
           * THREE CHILDREN, and they answer three different questions. "What
           * cases am I in" is the register; "when do I have to appear" is the
           * schedule, which is what a summons is about; "what has happened so
           * far" is the history. The old "My Cases" split them by WHO FILED
           * instead — two lists of the same shape, neither of which told a
           * person when to turn up.
           */
          {
            label: "Lupon Records",
            to: "/resident/lupon",
            icon: FiBookOpen,
            children: [
              /*
               * THE TWO SIDES ARE TWO ENTRIES, and they are different news.
               *
               * "Somebody filed a complaint against me" is what a resident
               * opens the portal to find out, and it was folded into one
               * "Filed Cases" list where it read as a case they had brought
               * themselves. A person named as a respondent is being summoned;
               * that deserves its own line and its own count.
               */
              { label: "Cases I Filed", to: "/resident/lupon/filed", icon: FiFileText },
              { label: "Cases Against Me", to: "/resident/lupon/against-me", icon: FiAlertCircle },
              { label: "Hearings", to: "/resident/lupon/hearings", icon: FiCalendar },
              { label: "Case History", to: "/resident/lupon/history", icon: FiClock },
            ],
          },
          /*
           * Read-only, and the page says so. A health record is written at
           * the station by the person who took the reading; a resident
           * reading their own is right, a resident editing it is not.
           */
          { label: "Health Records", to: "/resident/health", icon: FiActivity },
          { label: "Announcements", to: "/resident/announcements", icon: FiBell },
          // Profile carries the family too — same question, one button.
          { label: "My Profile", to: "/resident/profile", icon: FiUser },
        ],
      },
    ];
  }

  const sections: MenuSection[] = [
    { items: [{ label: "Dashboard", to: "/dashboard", icon: FiHome }] },
  ];

  /*
   * What a barangay secretary actually keeps.
   *
   * The session record and its minutes, and the mediation hearings — the
   * secretary is the officer who takes the minutes at both, which is why the
   * time and the attendance are set from here rather than from the docket.
   */
  const secretariat: MenuItem[] = [
    { label: "Barangay Sessions", to: "/sessions", icon: FiBookOpen },
    { label: "Hearing & Mediation", to: "/lupon/hearings", icon: FiCalendar },
    /* The Lupon, the VAWC desk and the health station in one return. The
       Secretary was copying figures off three screens onto paper, which is
       where a transcription error becomes a submitted report. */
    { label: "Consolidated Reports", to: "/reports/consolidated", icon: FiBarChart2 },
  ];

  /*
   * The Clerk works certificates, and nothing else.
   *
   * The queue belonged to a wider front desk. This one issues
   * documents: the list of them, the report on how many were asked for, and
   * the verification step that comes before one is filed.
   *
   * No Service Requests entry. A request for a certificate raises the
   * certificate the moment it is made — online or at the counter — so the
   * same piece of work appeared on two screens, and a clerk could start it
   * twice.
   *
   * The route is still there and still reachable. A service that produces no
   * document — a complaint, say — lives only in that list, and the field
   * takes any wording, so the list is kept rather than deleted.
   */
  if (user.role === "Clerk") {
    sections.push({
      heading: "Main Office",
      items: [
        { label: "Certificates", to: "/certificates", icon: FiAward },
        { label: "Certificate Report", to: "/certificates/report", icon: FiBarChart2 },
        /* The Lupon's fees are taken at this counter: ₱20 to file a case,
           ₱230 to certify a failed conciliation to court. The Lupon asks
           and watches for "Paid"; the money changes hands here. */
        /* The website's chat desk moved here from the Secretary: the person
           answering "how do I get a clearance?" should be the one who
           issues it. */
        { label: "Live Chat", to: "/chat", icon: FiMessageCircle },
      ],
    });
    return sections;
  }

  switch (user.office) {
    case "Main Office":
      if (user.role === "Punong Barangay") {
        /*
         * The Punong Barangay presides, and that is the whole menu.
         *
         * Certificates, the chat desk, administrative records, the session
         * record and the KP docket all came off: each is an office's own
         * work, and putting them here made the PB a second pair of hands on
         * six desks rather than the one person who sits at the mediation
         * table. What is left is the table: the sittings they conduct, the
         * settlements that come out of them, and the reports on both.
         */
        sections.push({
          heading: "Lupon Tagapamayapa",
          items: [
            /* Today's, upcoming and past sittings on one screen — the PB
               mediates on Tuesdays and needs to know which is which. */
            { label: "Hearings", to: "/lupon/hearings", icon: FiCalendar },
            { label: "Settlements", to: "/lupon/settlements", icon: FiFileText },
            { label: "Reports & Archives", to: "/lupon/reports", icon: FiBarChart2 },
          { label: "Consolidated Report", to: "/reports/consolidated", icon: FiLayers },
          ],
        });
        /* The return the PB signs, read before signing it. */
        sections.push({
          heading: "Barangay-wide",
          items: [
            { label: "Consolidated Reports", to: "/reports/consolidated", icon: FiBarChart2 },
          ],
        });
      } else {
        /*
         * The Secretary keeps the record of what was decided, and nothing
         * else. Appointments, Records Verification and the chat desk all
         * belong to the front counter; administrative records came off with
         * them. What is left is the session minutes, the hearings they take
         * the minutes of, and the reports drawn from both.
         */
        sections.push({ heading: "Secretariat", items: secretariat });
      }
      break;

    // Deliberately no general Referrals/Reports entry: the VAWC Desk keeps its
    // own referral trail and anonymized reporting, isolated from shared lists.
    case "VAWC":
      sections.push({
        heading: "VAWC Desk",
        items: [
          { label: "Confidential Cases", to: "/vawc/cases", icon: FiShield },
          /*
           * Referrals and Follow-Up Monitoring are off the menu. Both are
           * recorded on the case itself, where the officer already is; a
           * second screen listing them across cases was a separate place to
           * look and a separate place to forget.
           */
          { label: "Documents & Access Trail", to: "/vawc/documents", icon: FiFolder },
          { label: "Reports", to: "/vawc/reports", icon: FiBarChart2 },
          /* The desk's own consolidated return, generated rather than
             transcribed. Counts only — the section carries no case. */
          { label: "Consolidated Report", to: "/reports/consolidated", icon: FiLayers },
        ],
      });
      break;

    /*
     * The Lupon works its own docket only. Request intake, the window queue
     * and appointments belong to the Main Office front desk; the Lupon's own
     * calendar is Hearings, and its own reporting is Reports & Archives.
     */
    case "Lupon":
      sections.push({
        heading: "Lupon Tagapamayapa",
        items: [
          { label: "Case Docket", to: "/lupon/cases", icon: FiBookOpen },
          { label: "Hearings & KP Forms", to: "/lupon/hearings", icon: FiCalendar },
          { label: "Settlements", to: "/lupon/settlements", icon: FiFileText },
          { label: "Reports & Archives", to: "/lupon/reports", icon: FiBarChart2 },
        ],
      });
      break;

    case "Population":
      sections.push({
        heading: "Population Office",
        items: [
          { label: "Residents", to: "/population/residents", icon: FiUsers },
          /*
           * RBIM CENSUS IS NOT HERE ANY MORE, and that is deliberate.
           *
           * It was a menu entry whose list repeated the Households list and
           * whose form was reached from a third place. The census is now
           * started from a button on the resident register — where the
           * office already is when a household walks in — and the forms
           * themselves are read in the Households table.
           */
          { label: "Households", to: "/population/households", icon: FiMap },
          { label: "Sector Lists", to: "/population/sectors", icon: FiLayers },
          { label: "Portal Accounts", to: "/population/accounts", icon: FiUserPlus },
        ],
      });
      break;

    // Health referrals are recorded on the visit / maternal / child forms
    // themselves, and the station reports from its own coverage figures.
    case "Health Station":
      sections.push({
        heading: "Health Station",
        items: [
          { label: "Patient Visits", to: "/health/visits", icon: FiHeart },
          { label: "Immunization", to: "/health/immunization", icon: FiShield },
          { label: "Maternal & Child", to: "/health/maternal-child", icon: FiSmile },
          /*
           * Moved here from the Population Office.
           *
           * A zone's health worker is the health station's own staff — they
           * know when somebody takes over an area, and the BPO learned it
           * second-hand. The register still READS the zone list; only the
           * keeping of it moved.
           */
          { label: "Zones & BHWs", to: "/health/zones", icon: FiMapPin },
          { label: "Consolidated Report", to: "/reports/consolidated", icon: FiLayers },
        ],
      });
      break;

    case "SK":
      sections.push({
        heading: "Sangguniang Kabataan",
        items: [
          { label: "Home Pictures", to: "/sk/hero-slides", icon: FiImage },
          { label: "News & Announcements", to: "/sk/announcements", icon: FiBell },
          { label: "Officials", to: "/sk/officials", icon: FiAward },
        ],
      });
      break;

    // System administrator, not a barangay office — keeps reach into every
    // module so bad data can be corrected. (To be retired once each office
    // is seeded with its own account.)
    /*
     * The system administrator makes staff accounts, and looks after the
     * public landing page. That is the whole job.
     *
     * It used to reach into every module "so bad data can be corrected",
     * which meant one account could read the VAWC docket, the health records
     * and the resident register alike. Correcting bad data is the work of the
     * office that owns it — and an account that can go everywhere is the one
     * worth stealing.
     */
    case "Admin":
      sections.push({
        heading: "SK / Landing Content",
        items: [
          { label: "Home Pictures", to: "/sk/hero-slides", icon: FiImage },
          { label: "News & Announcements", to: "/sk/announcements", icon: FiBell },
          { label: "Officials", to: "/sk/officials", icon: FiAward },
        ],
      });
      sections.push({
        heading: "System Administration",
        items: [
          { label: "Staff Accounts", to: "/admin/users", icon: FiSettings },
          /* Its own entry rather than a tab: thirty-four residents and ten
             colleagues are two different jobs, and a tab hides one of them
             behind the other. */
          { label: "Resident Accounts", to: "/admin/residents", icon: FiUserPlus },
          /* Register entries, not accounts: not one of them has one, so a
             list of accounts would show an empty page. */
          { label: "Non-residents", to: "/admin/non-residents", icon: FiUserX },
        ],
      });
      break;
  }

  return sections;
}
