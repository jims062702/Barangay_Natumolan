import { Fragment, Suspense, type ComponentProps, type ReactNode } from "react";
import {
  LoginSkeleton,
  PublicPageSkeleton,
} from "../shared/ui/Skeleton";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { censusFormKey } from "../features/rbim/lib/formKey";
import { AuthProvider } from "../shared/auth/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import FormValidationStyler from "./FormValidationStyler";
import IdleSignOut from "../features/account/components/IdleSignOut";
import ErrorBoundary from "./ErrorBoundary";
import NotFound from "./NotFound";
import MovedTo from "./MovedTo";
import MainLayout from "./layouts/MainLayout";

// The public landing page loads eagerly — it is what most residents open.
import LandingPage from "../features/public/pages/LandingPage";
import { lazyRoute } from "./lazyRoute";

// Everything else is lazy-loaded (code-split): visitors download only the
// code for the page they open, which keeps the public site small and fast.
/*
 * NOT lazily loaded, deliberately.
 *
 * Every signed-in page in this system is inside this layout, so splitting
 * it off bought nothing and cost a whole extra waiting stage: the session
 * resolved behind a drawn shell, then the LAYOUT was fetched behind the
 * same drawn shell, and only then did the real sidebar appear. A hard
 * reload showed two different skeletons one after the other, which is what
 * the office reported — and the second wait was for 22 KB that every one
 * of these pages needs anyway.
 */
import DashboardLayout from "./layouts/DashboardLayout";
const LoginPage = lazyRoute(() => import("../features/account/pages/LoginPage"));
const VerifyCertificate = lazyRoute(() => import("../features/public/pages/VerifyCertificate"));
const VerifyResidentId = lazyRoute(() => import("../features/public/pages/VerifyResidentId"));
const ReportVawc = lazyRoute(() => import("../features/public/pages/ReportVawc"));
const RequestCertificate = lazyRoute(() => import("../features/public/pages/RequestCertificate"));
const FileComplaint = lazyRoute(() => import("../features/public/pages/FileComplaint"));
const NewsDetail = lazyRoute(() => import("../features/public/pages/NewsDetail"));

// Office dashboards
const Dashboard = lazyRoute(() => import("../features/dashboard/pages/Dashboard"));
const ConsolidatedReport = lazyRoute(() => import("../features/dashboard/pages/ConsolidatedReport"));
const OfficeReport = lazyRoute(() => import("../features/dashboard/pages/OfficeReport"));

// Resident portal
const PortalDashboard = lazyRoute(() => import("../features/portal/pages/Dashboard"));
const PortalRequests = lazyRoute(() => import("../features/portal/pages/Requests"));
const PortalAnnouncements = lazyRoute(() => import("../features/portal/pages/Announcements"));
const PortalProfile = lazyRoute(() => import("../features/portal/pages/Profile"));

// Shared core (staff)
const LuponRecords = lazyRoute(() => import("../features/portal/pages/LuponRecords"));
const PortalFileComplaint = lazyRoute(() => import("../features/portal/pages/FileComplaint"));
const PortalVawcRecords = lazyRoute(() => import("../features/portal/pages/VawcRecords"));
const PortalHealthRecords = lazyRoute(() => import("../features/portal/pages/HealthRecords"));
const ResidentList = lazyRoute(() => import("../features/resident/pages/ResidentList"));
const ResidentCreate = lazyRoute(() => import("../features/resident/pages/ResidentCreate"));
const ResidentDetail = lazyRoute(() => import("../features/resident/pages/ResidentDetail"));
const ResidentEdit = lazyRoute(() => import("../features/resident/pages/ResidentEdit"));
const ServiceRequestList = lazyRoute(() => import("../features/service/pages/ServiceRequestList"));
const CertificateList = lazyRoute(() => import("../features/service/pages/CertificateList"));
const CertificateReport = lazyRoute(() => import("../features/service/pages/CertificateReport"));
const LiveChat = lazyRoute(() => import("../features/chat/pages/LiveChat"));
const Sessions = lazyRoute(() => import("../features/council/pages/Sessions"));
const AppointmentsList = lazyRoute(() => import("../features/council/pages/AppointmentsList"));
const AppointmentsCalendar = lazyRoute(() => import("../features/council/pages/AppointmentsCalendar"));
const ResidentAppointments = lazyRoute(() => import("../features/portal/pages/ResidentAppointments"));

// VAWC Office
const VawcCasesList = lazyRoute(() => import("../features/vawc/pages/CaseList"));
const VawcCaseDetail = lazyRoute(() => import("../features/vawc/pages/CaseDetail"));
const VawcDocuments = lazyRoute(() => import("../features/vawc/pages/Documents"));
const VawcReports = lazyRoute(() => import("../features/vawc/pages/Reports"));
const VawcOnlineReports = lazyRoute(() => import("../features/vawc/pages/OnlineReports"));

// Lupon Tagapamayapa
const LuponCasesList = lazyRoute(() => import("../features/lupon/pages/CaseList"));
const LuponCaseDetail = lazyRoute(() => import("../features/lupon/pages/CaseDetail"));
const LuponHearings = lazyRoute(() => import("../features/lupon/pages/Hearings"));
const LuponHearingCalendar = lazyRoute(() => import("../features/lupon/pages/HearingCalendar"));
const LuponHearingSession = lazyRoute(() => import("../features/lupon/pages/HearingSession"));
const LuponSettlements = lazyRoute(() => import("../features/lupon/pages/Settlements"));
const LuponReports = lazyRoute(() => import("../features/lupon/pages/Reports"));
const LuponOnlineComplaints = lazyRoute(() => import("../features/lupon/pages/OnlineComplaints"));

// Population Office
const HouseholdList = lazyRoute(() => import("../features/population/pages/HouseholdList"));
const CensusForm = lazyRoute(() => import("../features/rbim/pages/CensusForm"));
const RecordsVerification = lazyRoute(() => import("../features/population/pages/RecordsVerification"));
const SectorLists = lazyRoute(() => import("../features/population/pages/SectorLists"));
const ResidentAccounts = lazyRoute(() => import("../features/population/pages/ResidentAccounts"));

// Health Station
const PatientVisits = lazyRoute(() => import("../features/health/pages/PatientVisits"));
const Immunization = lazyRoute(() => import("../features/health/pages/Immunization"));
const ChildHealth = lazyRoute(() => import("../features/health/pages/ChildHealth"));
const MaternalHealth = lazyRoute(() => import("../features/health/pages/MaternalHealth"));
const MotherRecord = lazyRoute(() => import("../features/health/pages/MotherRecord"));
const PrenatalRecords = lazyRoute(() => import("../features/health/pages/PrenatalRecords"));
const HealthReports = lazyRoute(() => import("../features/health/pages/HealthReports"));

// Sangguniang Kabataan (landing content)
const HeroSlides = lazyRoute(() => import("../features/content/pages/HeroSlides"));
const Officials = lazyRoute(() => import("../features/council/pages/Officials"));

// Management / Admin
const AdministrativeRecords = lazyRoute(() => import("../features/records/pages/AdministrativeRecords"));
const Announcements = lazyRoute(() => import("../features/content/pages/Announcements"));
const UserManagement = lazyRoute(() => import("../features/admin/pages/UserManagement"));
const NonResidents = lazyRoute(() => import("../features/admin/pages/NonResidents"));

/**
 * What a page chunk downloads behind.
 *
 * The same shell the session check shows, so the two waits look like one
 * page loading rather than two different loading screens in a row.
 */
function PageLoader() {
  return <PublicPageSkeleton />;
}

/*
 * There is no Shell() boundary any more.
 *
 * It existed to wait for the layout chunk, which is no longer a chunk. The
 * page inside the layout still waits behind its own Suspense (see
 * DashboardLayout), and that one draws the shape of the page being opened
 * inside the REAL sidebar — so the chrome no longer swaps halfway through.
 */

/**
 * A page opened by id is a new page for each id.
 *
 * Without it, following a link from one resident to another — a parent, a
 * spouse — kept the first one's page on screen while the second loaded,
 * because the route and the component were the same. Keyed on the id, the
 * second opens as itself: its own skeleton, then its own record.
 */
function ByRecord({ children }: { children: ReactNode }) {
  const { id } = useParams();

  return <Fragment key={id}>{children}</Fragment>;
}

/**
 * A census form, opened by id — and a NEW census form that has just saved
 * its first draft, which moves to that draft's address WITHOUT reopening.
 *
 * The form saves itself as a draft (useCensusSubmit). A brand-new sheet has
 * no id until the first save, and moving from /population/rbim/new to
 * /population/rbim/12 used to reopen the page from scratch — which is how
 * the first press of Preview form saved the draft and then showed nothing.
 * The form carries its own key across that one move (censusFormKey in the
 * navigation state), so the office keeps typing in the same page; any other
 * arrival — another draft, a fresh /new — opens as itself.
 */
function CensusRecord({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const location = useLocation();
  const carried = (location.state as { censusFormKey?: string } | null)?.censusFormKey;

  return <Fragment key={censusFormKey(id, location.key, carried)}>{children}</Fragment>;
}

/** Who may open a part of the app, with the dashboard shell around it. */
function Guarded(props: Omit<ComponentProps<typeof ProtectedRoute>, "children">) {
  return (
    <ProtectedRoute {...props}>
      <DashboardLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FormValidationStyler />
        {/* Inside the router, so it can navigate; outside every route, so
            the countdown survives moving between pages. */}
        <IdleSignOut />
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public site */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="news/:id" element={<NewsDetail />} />
          </Route>
          <Route
            path="/login"
            element={
              <Suspense fallback={<LoginSkeleton />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route path="/verify" element={<VerifyCertificate />} />
          {/* Where a Barangay Resident ID's QR leads. */}
          <Route path="/id/:code" element={<VerifyResidentId />} />
          {/* VAWC Online Complaint — residents only, about a resident (2026-09-29). */}
          <Route path="/vawc-complaint" element={<ReportVawc />} />
          {/* Online Certificate Request — residents only, by their Resident ID, no account needed. */}
          <Route path="/request-certificate" element={<RequestCertificate />} />
          {/* Its first address, still arriving from links already sent. */}
          <Route path="/report-vawc" element={<Navigate to="/vawc-complaint" replace />} />
          {/*
            Beginning a KP complaint without signing in.

            Its own address rather than a section of the landing page: it
            is a long form with an upload on it, somebody may be sent the
            link by the office, and a complaint half-typed should survive
            a scroll. It files nothing — see the page.
          */}
          <Route path="/file-complaint" element={<FileComplaint />} />

          {/* Resident portal */}
          <Route path="/resident" element={<Guarded residentOnly />}>
            <Route index element={<PortalDashboard />} />
            <Route path="requests" element={<PortalRequests />} />
            <Route path="appointments" element={<ResidentAppointments />} />
            {/*
              The old certificates page, folded into requests.

              A redirect rather than a deletion: the link is in notification
              emails already sent, and a resident following one should land
              on the list that now holds their certificate, not on nothing.
            */}
            <Route path="certificates" element={<Navigate to="/resident/requests" replace />} />
            {/* Two entries in the sidebar, because they are two different
                pieces of news. The bare path still shows both, for an old
                link. */}
            {/*
              One page, five addresses. The view is read from the path so each
              sidebar child lands somewhere real — and a resident can bookmark
              "cases against me" rather than a tab state.
            */}
            <Route path="lupon" element={<LuponRecords key="lupon" />} />
            <Route path="lupon/filed" element={<LuponRecords key="filed" />} />
            <Route path="lupon/against-me" element={<LuponRecords key="against-me" />} />
            <Route path="lupon/hearings" element={<LuponRecords key="hearings" />} />
            <Route path="lupon/history" element={<LuponRecords key="history" />} />
            {/* The address the old single list lived at. */}
            <Route path="lupon/cases" element={<Navigate to="/resident/lupon/filed" replace />} />
            {/* Online complaints — filed and followed under Lupon Records */}
            <Route path="lupon/complaints" element={<PortalFileComplaint />} />
            <Route path="file-complaint" element={<Navigate to="/resident/lupon/complaints" replace />} />
            {/* VAWC Records — 4 dedicated sub-routes matching the sidebar dropdown */}
            <Route path="vawc" element={<PortalVawcRecords key="vawc" />} />
            <Route path="vawc/reports" element={<PortalVawcRecords key="reports" />} />
            <Route path="vawc/cases" element={<PortalVawcRecords key="cases" />} />
            <Route path="vawc/bpo" element={<PortalVawcRecords key="bpo" />} />
            <Route path="vawc/tracking" element={<PortalVawcRecords key="tracking" />} />
            {/* Redirect old single page to the reports view */}
            <Route path="vawc-report" element={<Navigate to="/resident/vawc/reports" replace />} />
            {/* Read only — the page says so, and the API offers no writer. */}
            <Route path="health" element={<PortalHealthRecords />} />
            <Route path="announcements" element={<PortalAnnouncements />} />
            {/* Folded into the profile page; keep the old address working. */}
            <Route path="family" element={<Navigate to="/resident/profile" replace />} />
            <Route path="profile" element={<PortalProfile />} />
          </Route>

          {/* The only page every staff account shares — each office's own
              dashboard is chosen inside <Dashboard/> by office. */}
          <Route element={<Guarded staffOnly />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Resident registry — the Population Office (BPO) owns it. They are
              the only office that registers a person, so they are the only one
              that browses the registry. Every other office attaches a resident
              through the picker, which returns identity fields only. */}
          <Route element={<Guarded staffOnly allowedOffices={["Population"]} />}>
            {/*
              The register moved under /population, where the office's other
              pages live — and away from /resident, the portal, which it was
              one letter from.

              The old addresses still resolve: staff have these bookmarked,
              and a bookmark that 404s teaches people the system is
              unreliable. `*` carries the rest of the path across, so a link
              to a particular person still lands on that person.
            */}
            <Route path="/residents/*" element={<MovedTo to="/population/residents" />} />
            <Route path="/population/residents" element={<ResidentList />} />
            {/* Their own list: relatives who live elsewhere are on the
                register but are not constituents, and mixing them into
                the purok roll makes both lists unusable. */}
            {/*
              The SAME pages, at an address that says what the record is.
              /residents/911 could not tell the sidebar, the breadcrumb or a
              shared link whether 911 lives here — the URL had to be read
              against the database to know. Each page redirects itself to
              whichever of the two it belongs on, so however you arrive, the
              address ends up true.
            */}
            <Route path="/population/residents/non-residents/:id" element={<ByRecord><ResidentDetail /></ByRecord>} />
            <Route path="/population/residents/non-residents/:id/edit" element={<ByRecord><ResidentEdit /></ByRecord>} />
            <Route path="/population/residents/create" element={<ResidentCreate />} />
            <Route path="/population/residents/:id" element={<ByRecord><ResidentDetail /></ByRecord>} />
            <Route path="/population/residents/:id/edit" element={<ByRecord><ResidentEdit /></ByRecord>} />
          </Route>

          {/* Counter verification — "is this person registered, and do they
              have a portal account?" The front desk runs this before filing a
              certificate, so it is NOT part of the registry group above. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office", "Population"]} />}>
            <Route path="/verify-records" element={<RecordsVerification />} />
          </Route>

          {/* Front desk — request intake and the window queue. Main Office
              only: the Lupon works its docket, not the service counter.

              Not the Secretary, mirroring deny_role:Secretary on the route.
              The guard used to let them in and the server then refused, so
              the page opened, asked, and showed a 403 it could not explain —
              and with no line, an error with nothing behind it at all. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Secretary"]} />}>
            <Route path="/services" element={<ServiceRequestList />} />
          </Route>

          {/* Appointments sit behind the front desk but not with the Clerk,
              whose remit is requests & certificates (mirrors deny_role:Clerk). */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office", "Admin"]} allowedRoles={["Punong Barangay", "Secretary", "Admin"]} deniedRoles={["Clerk"]} />}>
            {/* The secretary's own record, which the PB reads and adopts. */}
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/appointments" element={<AppointmentsList />} />
            <Route path="/appointments/calendar" element={<AppointmentsCalendar />} />
          </Route>

          {/*
            The consolidated return — the Secretary's and the Punong
            Barangay's, gathering every office. No desk opens it: each keeps a
            report of its own. The Clerk is Main Office too, so is turned away
            by role.
          */}
          <Route
            element={
              <Guarded
                staffOnly
                allowedOffices={["Main Office", "Admin"]}
                allowedRoles={["Punong Barangay", "Secretary", "Admin"]}
                deniedRoles={["Clerk"]}
              />
            }
          >
            <Route path="/reports/consolidated" element={<ConsolidatedReport />} />
          </Route>

          {/*
            An office's OWN report, for the two that had none. Same page for
            both; which office's figures it shows is decided by the server
            from the account signed in, not by the address.
          */}
          <Route element={<Guarded staffOnly allowedOffices={["Health Station"]} />}>
            {/* The station summary, and the record books' monthly and
                yearly reports — chosen with one filter. */}
            <Route path="/health/reports" element={<HealthReports />} />
          </Route>
          <Route element={<Guarded staffOnly allowedOffices={["Population"]} />}>
            <Route path="/population/reports" element={<OfficeReport />} />
          </Route>

          {/* Certificates & clearances — the clerk runs the counter end to
              end; the PB/Secretary only sign the printed paper. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Secretary"]} />}>
            <Route path="/certificates" element={<CertificateList />} />
            <Route path="/certificates/report" element={<CertificateReport />} />
            {/* Lupon fees, taken at the Clerk's counter. The Lupon asks;
                the Main Office collects and writes the receipt. */}
          </Route>

          {/* Live chat desk — the CLERK alone answers the website's chat
              widget. The person asked "how do I get a clearance?" should be
              the one who issues it. Mirrors the API, which turns away the
              Secretary and the Punong Barangay. */}
          <Route element={<Guarded staffOnly allowedRoles={["Clerk"]} />}>
            <Route path="/chat" element={<LiveChat />} />
          </Route>

          {/* VAWC Office — isolated */}
          <Route element={<Guarded staffOnly allowedOffices={["VAWC"]} />}>
            <Route path="/vawc/cases" element={<VawcCasesList key="active" initialStatus="Active" />} />
            <Route path="/vawc/cases/closed" element={<VawcCasesList key="closed" initialStatus="Closed" />} />
            <Route path="/vawc/cases/:id" element={<ByRecord><VawcCaseDetail /></ByRecord>} />
            <Route path="/vawc/documents" element={<VawcDocuments />} />
            <Route path="/vawc/reports" element={<VawcReports />} />
            <Route path="/vawc/online-reports" element={<VawcOnlineReports />} />
          </Route>

          {/* Lupon — Lupon office + Main Office (PB & Secretary), Admin; denies Clerk */}
          <Route element={<Guarded staffOnly allowedOffices={["Lupon", "Main Office", "Admin"]} allowedRoles={["Punong Barangay", "Secretary", "Admin"]} deniedRoles={["Clerk"]} />}>
            <Route path="/lupon/cases" element={<LuponCasesList />} />
            {/* The queue in front of the docket. Same guard, because
                accepting one of these IS filing a case. */}
            <Route path="/lupon/online-complaints" element={<LuponOnlineComplaints />} />
            <Route path="/lupon/cases/:id" element={<ByRecord><LuponCaseDetail /></ByRecord>} />
            <Route path="/lupon/settlements" element={<LuponSettlements />} />
            <Route path="/lupon/reports" element={<LuponReports />} />
          </Route>

          {/*
            The hearing calendar, and only that.

            The barangay secretary takes the minutes at a mediation, so they
            reach the hearings without being given the docket behind them —
            which is why this is its own guard rather than a wider Lupon one.
          */}
          <Route element={<Guarded staffOnly allowedOffices={["Lupon", "Main Office"]} allowedRoles={["Punong Barangay", "Secretary"]} deniedRoles={["Clerk"]} />}>
            <Route path="/lupon/hearings" element={<LuponHearings key="all" />} />
            {/* What has been forwarded to this desk and has no sitting yet.
                Its own address because it is the first thing the Secretary
                and the Lupon open: the work somebody handed them. */}
            <Route path="/lupon/hearings/for-summons" element={<LuponHearings key="for-summons" section="for-summons" />} />
            {/* Ahead and behind. These were a dropdown on the page — state,
                not places — so neither could be linked to and both reported
                the same address as today's list. */}
            {/* The Punong Barangay's month, read-only. They preside and
                record nothing, so a table of buttons they may not press is
                the wrong shape; the Lupon watches the same screen. */}
            <Route path="/lupon/hearings/calendar" element={<LuponHearingCalendar />} />
            <Route path="/lupon/hearings/upcoming" element={<LuponHearings key="upcoming" section="upcoming" />} />
            <Route path="/lupon/hearings/past" element={<LuponHearings key="past" section="past" />} />
            {/* The two registers the room keeps beside the calendar. Their
                own addresses, because the office is asked to produce them
                months later and a link is how they are found again. */}
            <Route path="/lupon/hearings/cancelled" element={<LuponHearings key="cancelled" section="cancelled" />} />
            <Route path="/lupon/hearings/cfa" element={<LuponHearings key="cfa" section="cfa" />} />
            {/* The sitting itself: minutes taken with the parties present. */}
            <Route path="/lupon/hearings/:id/session" element={<ByRecord><LuponHearingSession /></ByRecord>} />
          </Route>

          {/* Population Office */}
          <Route element={<Guarded staffOnly allowedOffices={["Population"]} />}>
            <Route path="/population/households" element={<HouseholdList />} />
            {/* The census list lives on the Households page now. The old
                address still works, so a bookmark or an old link lands
                where the list actually is. */}
            <Route path="/population/rbim" element={<Navigate to="/population/residents" replace />} />
            <Route path="/population/rbim/new" element={<CensusRecord><CensusForm /></CensusRecord>} />
            <Route path="/population/rbim/:id" element={<CensusRecord><CensusForm /></CensusRecord>} />
            <Route path="/population/sectors" element={<SectorLists />} />
            {/* People who filed online as residents and are not on the
                register. Nothing here is a resident record — the census
                is still the only route onto the register. */}
            {/* The two lists the sidebar opens into; the bare address — on the
                dashboard and in older links — lands on the one to work. */}
            <Route path="/population/accounts" element={<ResidentAccounts key="all" activation="all" />} />
            <Route path="/population/accounts/not-activated" element={<Navigate to="/population/accounts" replace />} />
            <Route path="/population/accounts/activated" element={<Navigate to="/population/accounts" replace />} />
          </Route>

          {/* Health Station — isolated */}
          <Route element={<Guarded staffOnly allowedOffices={["Health Station"]} />}>
            <Route path="/health/visits" element={<PatientVisits />} />
            <Route path="/health/immunization" element={<Immunization />} />
            {/*
              The three record books. "Maternal & Child" was one page keeping
              one record per mother and one per child; its address still lands
              somewhere useful, and so do the short-lived /records and
              per-book report addresses.
            */}
            <Route path="/health/maternal-child" element={<Navigate to="/health/child-health" replace />} />
            <Route path="/health/child-health" element={<ChildHealth />} />
            <Route path="/health/maternal" element={<MaternalHealth />} />
            <Route path="/health/maternal/pregnancy/:id" element={<ByRecord><MotherRecord /></ByRecord>} />
            <Route path="/health/prenatal" element={<PrenatalRecords />} />
            <Route path="/health/child-health/records" element={<Navigate to="/health/child-health" replace />} />
            <Route path="/health/maternal/records" element={<Navigate to="/health/maternal" replace />} />
            <Route path="/health/prenatal/records" element={<Navigate to="/health/prenatal" replace />} />
            <Route path="/health/child-health/reports/monthly" element={<Navigate to="/health/reports?report=child&period=monthly" replace />} />
            <Route path="/health/child-health/reports/yearly" element={<Navigate to="/health/reports?report=child&period=yearly" replace />} />
            <Route path="/health/maternal/reports/monthly" element={<Navigate to="/health/reports?report=maternal&period=monthly" replace />} />
            <Route path="/health/maternal/reports/yearly" element={<Navigate to="/health/reports?report=maternal&period=yearly" replace />} />
            <Route path="/health/prenatal/reports/monthly" element={<Navigate to="/health/reports?report=prenatal&period=monthly" replace />} />
            <Route path="/health/prenatal/reports/yearly" element={<Navigate to="/health/reports?report=prenatal&period=yearly" replace />} />
          </Route>

          {/* Public Landing Content — managed by Secretary, Clerk, and Admin (PB is excluded) */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office", "Admin"]} allowedRoles={["Secretary", "Clerk", "Admin"]} deniedRoles={["Punong Barangay"]} />}>
            <Route path="/content/hero-slides" element={<HeroSlides />} />
            <Route path="/content/announcements" element={<Announcements />} />
            <Route path="/content/officials" element={<Officials />} />
            {/* Backward-compatible redirects from legacy /sk/* URLs */}
            <Route path="/sk/hero-slides" element={<Navigate to="/content/hero-slides" replace />} />
            <Route path="/sk/announcements" element={<Navigate to="/content/announcements" replace />} />
            <Route path="/sk/officials" element={<Navigate to="/content/officials" replace />} />
            <Route path="/sk" element={<Navigate to="/content/hero-slides" replace />} />
            <Route path="/sk/*" element={<Navigate to="/content/hero-slides" replace />} />
          </Route>

          {/* Service guides (AI KB) & administrative records — Main Office / PB / Admin
              (the Clerk is limited to requests & certificates) */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office", "Admin"]} allowedRoles={["Punong Barangay", "Admin"]} deniedRoles={["Clerk"]} />}>
            <Route path="/records" element={<AdministrativeRecords />} />
          </Route>

          {/* System administration */}
          <Route element={<Guarded staffOnly allowedRoles={["Admin"]} />}>
            <Route path="/admin/users" element={<UserManagement key="staff" />} />
            {/* The same register, asked a different question. Its own address
                so it can be linked to, bookmarked and put in the sidebar. */}
            <Route path="/admin/residents" element={<UserManagement key="resident" kind="resident" />} />
            {/* Register entries, not accounts — see the page for why. */}
            <Route path="/admin/non-residents" element={<NonResidents />} />
          </Route>

          {/* Anything else — without this, an unknown address renders an
              empty document (the blank white screen). */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
