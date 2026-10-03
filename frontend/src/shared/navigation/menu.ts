import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiFileText,
  FiFilePlus,
  FiFolder,
  FiHeart,
  FiHome,
  FiImage,
  FiInbox,
  FiLayers,
  FiMail,
  FiMap,
  FiMessageCircle,
  FiSettings,
  FiShield,
  FiSlash,
  FiSmile,
  FiUser,
  FiUserCheck,
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
           * FILING ONE, which is not the same thing as having one.
           *
           * Its own entry above Lupon Records, deliberately: a complaint sent
           * from here is NOT a case, it is a reference number and an
           * instruction to come to the office. Putting it among the cases
           * would tell a resident they had filed when they had not.
           */
          { label: "File a Complaint", to: "/resident/file-complaint", icon: FiFilePlus },
          /*
           * A VAWC report to the VAW Desk — its own entry, apart from the
           * Lupon's complaint form, because the law keeps the two apart: KP
           * mediation is prohibited for violence against women and children.
           * The office asked for residents to follow their reports here.
           */
          { label: "VAWC Online Complaint", to: "/resident/vawc-report", icon: FiShield },
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
  /*
   * THE SIDEBAR IS THE ONLY MENU FOR THIS ROOM, AND IT IS NOT THE SAME
   * MENU FOR EVERY OFFICE.
   *
   * The page used to carry a row of pills repeating these, one of them a
   * dropdown hiding Today, Upcoming and Past — two menus for one set of
   * screens, and those three were state rather than places, so none of
   * them could be linked to. Every list is an entry here now.
   *
   * But the three offices do different work in this room, and one shared
   * list handed each of them the other two's screens:
   *
   *   Secretary   works the Punong Barangay's Tuesdays: prints the papers,
   *               writes the minutes on the day. The full set below.
   *   Lupon       works its own Thursdays, and WATCHES the Tuesdays — a
   *               case on its third is about to land on their desk.
   *   Punong      presides and records nothing. One screen: the month.
   *     Barangay
   */
  const hearingRoom: MenuItem[] = [
    /* First, because it is where the day starts: the cases forwarded to
       this desk, which have no sitting until the summons is printed. */
    { label: "For Summons", to: "/lupon/hearings/for-summons", icon: FiMail },
    { label: "Today's Hearing", to: "/lupon/hearings", icon: FiCalendar },
    { label: "Upcoming Hearing", to: "/lupon/hearings/upcoming", icon: FiClock },
    { label: "Past Hearings", to: "/lupon/hearings/past", icon: FiArchive },
    { label: "Cancelled", to: "/lupon/hearings/cancelled", icon: FiSlash },
    { label: "CFA Cases", to: "/lupon/hearings/cfa", icon: FiFileText },
  ];

  /* The Lupon's own conciliation hearings calendar (Thursdays). */
  const luponHearingRoom: MenuItem[] = [
    ...hearingRoom,
    { label: "Lupon Hearings Calendar", to: "/lupon/hearings/calendar", icon: FiCalendar },
  ];

  /* The Secretary's set with Punong Barangay Hearings Calendar (Tuesdays). */
  const secretaryHearingRoom: MenuItem[] = [
    ...hearingRoom,
    { label: "Punong Barangay Hearings Calendar", to: "/lupon/hearings/calendar", icon: FiCalendar },
  ];

  const secretariat: MenuItem[] = [
    { label: "Barangay Sessions", to: "/sessions", icon: FiBookOpen },
    { label: "Hearing & Mediation", to: "/lupon/hearings", icon: FiCalendar, children: secretaryHearingRoom },
    /* Every office in one return — Lupon, VAWC, Health, Population and the
       Clerk's certificates. The Secretary was copying figures off separate
       screens onto paper, which is where a transcription error becomes a
       submitted report. Only the Secretary and the PB have this entry; each
       office keeps a Reports page of its own. */
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
        /* No Lupon fees here at all: the Lupon presses Paid itself on
           sight of the receipt, and the Clerk takes no part in it. */
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
            /*
             * ONE SCREEN, AND IT WRITES NOTHING.
             *
             * They preside; the Barangay Secretary keeps the record. Six
             * list views with an Actions column offered them work they are
             * refused, so what is left is the month itself: which days the
             * hall sits, at what hour, who is coming, and the case behind
             * each one to read before walking into the room.
             */
            { label: "Punong Barangay Hearings Calendar", to: "/lupon/hearings/calendar", icon: FiCalendar },
            { label: "Settlements", to: "/lupon/settlements", icon: FiFileText },
            /*
             * No "Reports & Archives" here. Consolidated Reports below is
             * the return the Punong Barangay signs, and it already carries
             * the Lupon's figures along with every other office's — two
             * entries to the same numbers is two places to look and one
             * place to be told a different total.
             */
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
          /* Reports residents sent online, waiting to be verified. */
          { label: "Online Complaints", to: "/vawc/online-reports", icon: FiInbox },
          /*
           * Referrals and Follow-Up Monitoring are off the menu. Both are
           * recorded on the case itself, where the officer already is; a
           * second screen listing them across cases was a separate place to
           * look and a separate place to forget.
           */
          { label: "Documents & Access Trail", to: "/vawc/documents", icon: FiFolder },
          /* The desk's own report. The consolidated return is the
             Secretary's and the Punong Barangay's, not a desk's. */
          { label: "Reports", to: "/vawc/reports", icon: FiBarChart2 },
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
          /*
           * THE QUEUE IN FRONT OF THE DOCKET, and it sits above it because
           * that is the order the work arrives in: somebody filed on the
           * website overnight, and the Lupon reads it before the complainant
           * walks in. Nothing on that screen is a case until Accept is
           * pressed at the counter.
           */
          { label: "Online Complaints", to: "/lupon/online-complaints", icon: FiInbox },
          { label: "Case Docket", to: "/lupon/cases", icon: FiBookOpen },
          { label: "Hearings schedule", to: "/lupon/hearings", icon: FiCalendar, children: luponHearingRoom },
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
          /*
           * Two lists, opened from the sidebar: the accounts still waiting on
           * their resident, which is the office's work, and the ones already
           * in use. The count sits on the first.
           */
          {
            label: "Portal Accounts",
            to: "/population/accounts",
            icon: FiUserPlus,
            children: [
              { label: "Not activated", to: "/population/accounts/not-activated", icon: FiUserX },
              { label: "Activated", to: "/population/accounts/activated", icon: FiUserCheck },
            ],
          },
          { label: "Reports", to: "/population/reports", icon: FiBarChart2 },
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
          /*
           * The station's three record books. They were one "Maternal &
           * Child" page that kept one record per mother and one per child,
           * overwritten on every visit. Adding a record is the button on each
           * list, and their monthly and yearly reports are chosen on Reports —
           * one filter there, rather than six entries here.
           */
          { label: "Child Health & Nutrition", to: "/health/child-health", icon: FiSmile },
          { label: "Maternal Health", to: "/health/maternal", icon: FiUser },
          { label: "Prenatal Records", to: "/health/prenatal", icon: FiClipboard },
          /*
           * Moved here from the Population Office.
           *
           * A zone's health worker is the health station's own staff — they
           * know when somebody takes over an area, and the BPO learned it
           * second-hand. The register still READS the zone list; only the
           * keeping of it moved.
           */
          /* The station's own report. It was a "Consolidated Report" entry
             showing only the station's slice of the Secretary's return. */
          { label: "Reports", to: "/health/reports", icon: FiBarChart2 },
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
