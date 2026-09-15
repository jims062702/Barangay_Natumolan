import { Suspense, type ComponentProps } from "react";
import {
  AppShellSkeleton,
  LoginSkeleton,
  PublicPageSkeleton,
} from "../shared/ui/Skeleton";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../shared/auth/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import FormValidationStyler from "./FormValidationStyler";
import IdleSignOut from "../features/account/components/IdleSignOut";
import ErrorBoundary from "./ErrorBoundary";
import NotFound from "./NotFound";
import MainLayout from "./layouts/MainLayout";

// The public landing page loads eagerly — it is what most residents open.
import LandingPage from "../features/public/pages/LandingPage";
import { lazyRoute } from "./lazyRoute";

// Everything else is lazy-loaded (code-split): visitors download only the
// code for the page they open, which keeps the public site small and fast.
const DashboardLayout = lazyRoute(() => import("./layouts/DashboardLayout"));
const LoginPage = lazyRoute(() => import("../features/account/pages/LoginPage"));
const VerifyCertificate = lazyRoute(() => import("../features/public/pages/VerifyCertificate"));
const NewsDetail = lazyRoute(() => import("../features/public/pages/NewsDetail"));

// Office dashboards
const Dashboard = lazyRoute(() => import("../features/dashboard/pages/Dashboard"));

// Resident portal
const PortalDashboard = lazyRoute(() => import("../features/portal/pages/Dashboard"));
const PortalRequests = lazyRoute(() => import("../features/portal/pages/Requests"));
const PortalAppointments = lazyRoute(() => import("../features/portal/pages/Appointments"));
const PortalAnnouncements = lazyRoute(() => import("../features/portal/pages/Announcements"));
const PortalAssistant = lazyRoute(() => import("../features/portal/pages/Assistant"));
const PortalProfile = lazyRoute(() => import("../features/portal/pages/Profile"));

// Shared core (staff)
const PortalCases = lazyRoute(() => import("../features/portal/pages/Cases"));
const ResidentList = lazyRoute(() => import("../features/resident/pages/ResidentList"));
const NonResidentList = lazyRoute(() => import("../features/resident/pages/NonResidentList"));
const ResidentCreate = lazyRoute(() => import("../features/resident/pages/ResidentCreate"));
const ResidentDetail = lazyRoute(() => import("../features/resident/pages/ResidentDetail"));
const ResidentEdit = lazyRoute(() => import("../features/resident/pages/ResidentEdit"));
const ServiceRequestList = lazyRoute(() => import("../features/service/pages/ServiceRequestList"));
const CertificateList = lazyRoute(() => import("../features/service/pages/CertificateList"));
const CertificateReport = lazyRoute(() => import("../features/service/pages/CertificateReport"));
const LiveChat = lazyRoute(() => import("../features/chat/pages/LiveChat"));
const AppointmentScheduler = lazyRoute(() => import("../features/service/pages/AppointmentScheduler"));
const Sessions = lazyRoute(() => import("../features/council/pages/Sessions"));

// VAWC Office
const VawcCasesList = lazyRoute(() => import("../features/vawc/pages/CaseList"));
const VawcCaseDetail = lazyRoute(() => import("../features/vawc/pages/CaseDetail"));
const VawcReferrals = lazyRoute(() => import("../features/vawc/pages/Referrals"));
const VawcFollowups = lazyRoute(() => import("../features/vawc/pages/Followups"));
const VawcDocuments = lazyRoute(() => import("../features/vawc/pages/Documents"));
const VawcReports = lazyRoute(() => import("../features/vawc/pages/Reports"));

// Lupon Tagapamayapa
const LuponCasesList = lazyRoute(() => import("../features/lupon/pages/CaseList"));
const LuponCaseDetail = lazyRoute(() => import("../features/lupon/pages/CaseDetail"));
const LuponHearings = lazyRoute(() => import("../features/lupon/pages/Hearings"));
const LuponSettlements = lazyRoute(() => import("../features/lupon/pages/Settlements"));
const LuponReports = lazyRoute(() => import("../features/lupon/pages/Reports"));

// Population Office
const HouseholdList = lazyRoute(() => import("../features/population/pages/HouseholdList"));
const CensusList = lazyRoute(() => import("../features/rbim/pages/CensusList"));
const CensusForm = lazyRoute(() => import("../features/rbim/pages/CensusForm"));
const RecordsVerification = lazyRoute(() => import("../features/population/pages/RecordsVerification"));
const Events = lazyRoute(() => import("../features/population/pages/Events"));
const SectorLists = lazyRoute(() => import("../features/population/pages/SectorLists"));
const ResidentAccounts = lazyRoute(() => import("../features/population/pages/ResidentAccounts"));

// Health Station
const PatientVisits = lazyRoute(() => import("../features/health/pages/PatientVisits"));
const Immunization = lazyRoute(() => import("../features/health/pages/Immunization"));
const MaternalChild = lazyRoute(() => import("../features/health/pages/MaternalChild"));

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

/**
 * The dashboard shell, with the skeleton that matches it.
 *
 * Its own boundary, so the app shell is shown for the pages that HAVE an app
 * shell and for nothing else. One Suspense over the whole router put a
 * sidebar and a row of stat tiles in front of the sign-in page.
 */
function Shell() {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <DashboardLayout />
    </Suspense>
  );
}

/** Who may open a part of the app, with the dashboard shell around it. */
function Guarded(props: Omit<ComponentProps<typeof ProtectedRoute>, "children">) {
  return (
    <ProtectedRoute {...props}>
      <Shell />
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

          {/* Resident portal */}
          <Route path="/portal" element={<Guarded residentOnly />}>
            <Route index element={<PortalDashboard />} />
            <Route path="requests" element={<PortalRequests />} />
            <Route path="appointments" element={<PortalAppointments />} />
            {/*
              The old certificates page, folded into requests.

              A redirect rather than a deletion: the link is in notification
              emails already sent, and a resident following one should land
              on the list that now holds their certificate, not on nothing.
            */}
            <Route path="certificates" element={<Navigate to="/portal/requests" replace />} />
            <Route path="cases" element={<PortalCases />} />
            <Route path="announcements" element={<PortalAnnouncements />} />
            <Route path="assistant" element={<PortalAssistant />} />
            {/* Folded into the profile page; keep the old address working. */}
            <Route path="family" element={<Navigate to="/portal/profile" replace />} />
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
            <Route path="/residents" element={<ResidentList />} />
            {/* Their own list: relatives who live elsewhere are on the
                register but are not constituents, and mixing them into
                the purok roll makes both lists unusable. */}
            <Route path="/residents/non-residents" element={<NonResidentList />} />
            {/*
              The SAME pages, at an address that says what the record is.
              /residents/911 could not tell the sidebar, the breadcrumb or a
              shared link whether 911 lives here — the URL had to be read
              against the database to know. Each page redirects itself to
              whichever of the two it belongs on, so however you arrive, the
              address ends up true.
            */}
            <Route path="/residents/non-residents/:id" element={<ResidentDetail />} />
            <Route path="/residents/non-residents/:id/edit" element={<ResidentEdit />} />
            <Route path="/residents/create" element={<ResidentCreate />} />
            <Route path="/residents/:id" element={<ResidentDetail />} />
            <Route path="/residents/:id/edit" element={<ResidentEdit />} />
          </Route>

          {/* Counter verification — "is this person registered, and do they
              have a portal account?" The front desk runs this before filing a
              certificate, so it is NOT part of the registry group above. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office", "Population"]} />}>
            <Route path="/verify-records" element={<RecordsVerification />} />
          </Route>

          {/* Front desk — request intake and the window queue. Main Office
              only: the Lupon works its docket, not the service counter. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} />}>
            <Route path="/services" element={<ServiceRequestList />} />
          </Route>

          {/* Appointments sit behind the front desk but not with the Clerk,
              whose remit is requests & certificates (mirrors deny_role:Clerk). */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Clerk"]} />}>
            <Route path="/appointments" element={<AppointmentScheduler />} />
            {/* The secretary's own record, which the PB reads and adopts. */}
            <Route path="/sessions" element={<Sessions />} />
          </Route>

          {/* Certificates & clearances — the clerk runs the counter end to
              end; the PB/Secretary only sign the printed paper. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} />}>
            <Route path="/certificates" element={<CertificateList />} />
            <Route path="/certificates/report" element={<CertificateReport />} />
          </Route>

          {/* Live chat desk — the Secretary answers the website's chat widget.
              The Clerk is excluded: their remit is the service counter. */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Clerk"]} />}>
            <Route path="/chat" element={<LiveChat />} />
          </Route>

          {/* VAWC Office — isolated */}
          <Route element={<Guarded staffOnly allowedOffices={["VAWC"]} />}>
            <Route path="/vawc/cases" element={<VawcCasesList />} />
            <Route path="/vawc/cases/:id" element={<VawcCaseDetail />} />
            <Route path="/vawc/referrals" element={<VawcReferrals />} />
            <Route path="/vawc/followups" element={<VawcFollowups />} />
            <Route path="/vawc/documents" element={<VawcDocuments />} />
            <Route path="/vawc/reports" element={<VawcReports />} />
          </Route>

          {/* Lupon — Lupon office + Punong Barangay */}
          <Route element={<Guarded staffOnly allowedOffices={["Lupon"]} allowedRoles={["Punong Barangay"]} />}>
            <Route path="/lupon/cases" element={<LuponCasesList />} />
            <Route path="/lupon/cases/:id" element={<LuponCaseDetail />} />
            <Route path="/lupon/settlements" element={<LuponSettlements />} />
            <Route path="/lupon/reports" element={<LuponReports />} />
          </Route>

          {/*
            The hearing calendar, and only that.

            The barangay secretary takes the minutes at a mediation, so they
            reach the hearings without being given the docket behind them —
            which is why this is its own guard rather than a wider Lupon one.
          */}
          <Route element={<Guarded staffOnly allowedOffices={["Lupon", "Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Clerk"]} />}>
            <Route path="/lupon/hearings" element={<LuponHearings />} />
          </Route>

          {/* Population Office */}
          <Route element={<Guarded staffOnly allowedOffices={["Population"]} />}>
            <Route path="/population/households" element={<HouseholdList />} />
            <Route path="/population/rbim" element={<CensusList />} />
            <Route path="/population/rbim/new" element={<CensusForm />} />
            <Route path="/population/rbim/:id" element={<CensusForm />} />
            <Route path="/population/events" element={<Events />} />
            <Route path="/population/sectors" element={<SectorLists />} />
            <Route path="/population/accounts" element={<ResidentAccounts />} />
          </Route>

          {/* Health Station — isolated */}
          <Route element={<Guarded staffOnly allowedOffices={["Health Station"]} />}>
            <Route path="/health/visits" element={<PatientVisits />} />
            <Route path="/health/immunization" element={<Immunization />} />
            <Route path="/health/maternal-child" element={<MaternalChild />} />
          </Route>

          {/* Sangguniang Kabataan — manages public landing content */}
          <Route element={<Guarded staffOnly allowedOffices={["SK"]} allowedRoles={["Punong Barangay", "Admin"]} />}>
            <Route path="/sk/hero-slides" element={<HeroSlides />} />
            <Route path="/sk/announcements" element={<Announcements />} />
            <Route path="/sk/officials" element={<Officials />} />
          </Route>

          {/* Service guides (AI KB) & administrative records — Main Office / PB / Admin
              (the Clerk is limited to requests & certificates) */}
          <Route element={<Guarded staffOnly allowedOffices={["Main Office"]} allowedRoles={["Punong Barangay"]} deniedRoles={["Clerk"]} />}>
            <Route path="/records" element={<AdministrativeRecords />} />
          </Route>

          {/* System administration */}
          <Route element={<Guarded staffOnly allowedRoles={["Admin"]} />}>
            <Route path="/admin/users" element={<UserManagement />} />
            {/* The same register, asked a different question. Its own address
                so it can be linked to, bookmarked and put in the sidebar. */}
            <Route path="/admin/residents" element={<UserManagement kind="resident" />} />
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
