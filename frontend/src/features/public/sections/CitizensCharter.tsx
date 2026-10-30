import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiShield,
  FiCheckCircle,
  FiExternalLink,
  FiLayers,
  FiInfo,
} from "react-icons/fi";
import SectionTitle from "../components/SectionTitle";
import Reveal from "../../../shared/ui/Reveal";
import { useAuth } from "../../../shared/auth/AuthContext";
import {
  CITIZENS_CHARTER_CATEGORIES,
  CITIZENS_CHARTERS,
} from "../data/citizensCharter";

export default function CitizensCharter() {
  const { user, isAuthenticated } = useAuth();
  const isResident = user?.role === "Resident";

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleCharter = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenIds(new Set(CITIZENS_CHARTERS.map((c) => c.id)));
  };

  const collapseAll = () => {
    setOpenIds(new Set());
  };

  const filteredCharters = selectedCategory
    ? CITIZENS_CHARTERS.filter((c) => c.category === selectedCategory)
    : CITIZENS_CHARTERS;

  /**
   * Smart redirection and label based on whether the user is logged in or a guest:
   * - Guest (Not logged in): Redirect to the public Resident ID upload verification page (/request-certificate, /file-complaint, /vawc-complaint).
   * - Logged-in Resident: Redirect to their Resident Portal dashboard / dedicated filing section.
   * - Logged-in Staff: Redirect to their respective office management module.
   */
  const getActionForCharter = (charterId: string) => {
    if (isAuthenticated) {
      if (isResident) {
        switch (charterId) {
          case "05-barangay-clearance":
            return {
              url: "/resident/requests?type=Barangay%20Clearance",
              label: "Request Clearance via Portal",
            };
          case "04-barangay-certification":
            return {
              url: "/resident/requests?type=Barangay%20Certification",
              label: "Request Certification via Portal",
            };
          case "01-amicable-settlement":
          case "02-file-action":
            return {
              url: "/resident/lupon/complaints",
              label: "File Lupon Complaint via Portal",
            };
          case "03-issuance-agreement":
            return {
              url: "/resident/requests",
              label: "Request Agreement via Portal",
            };
          case "06-vawc-bpo":
            return {
              url: "/resident/vawc/reports",
              label: "Submit VAWC Report via Portal",
            };
          case "07-barangay-resolution":
          default:
            return {
              url: "/#contact",
              label: "Contact Sangguniang Barangay",
            };
        }
      } else {
        // Staff / Administrator logged in
        switch (charterId) {
          case "05-barangay-clearance":
          case "04-barangay-certification":
          case "03-issuance-agreement":
            return {
              url: "/certificates",
              label: "Open Certificates Desk",
            };
          case "01-amicable-settlement":
          case "02-file-action":
            return {
              url: "/lupon/cases",
              label: "Open Lupon Docket",
            };
          case "06-vawc-bpo":
            return {
              url: "/vawc",
              label: "Open VAWC Desk",
            };
          case "07-barangay-resolution":
          default:
            return {
              url: "/dashboard",
              label: "Open Office Dashboard",
            };
        }
      }
    }

    // Guest / Not signed in: Direct to the public service page requiring Barangay Resident ID upload
    switch (charterId) {
      case "05-barangay-clearance":
        return {
          url: "/request-certificate?type=Barangay%20Clearance",
          label: "Request Clearance (Upload Resident ID)",
        };
      case "04-barangay-certification":
        return {
          url: "/request-certificate?type=Barangay%20Certification",
          label: "Request Certification (Upload Resident ID)",
        };
      case "01-amicable-settlement":
      case "02-file-action":
        return {
          url: "/file-complaint",
          label: "File Complaint (Upload Resident ID)",
        };
      case "03-issuance-agreement":
        return {
          url: "/request-certificate",
          label: "Request Online (Upload Resident ID)",
        };
      case "06-vawc-bpo":
        return {
          url: "/vawc-complaint",
          label: "File VAWC Report (Upload Resident ID)",
        };
      case "07-barangay-resolution":
      default:
        return {
          url: "/#contact",
          label: "Contact Sangguniang Barangay",
        };
    }
  };

  return (
    <section id="charter" className="pattern pattern-dots bg-secondary py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Official Service Standards"
          title="Citizen's Charter"
          subtitle="The official guide to services, procedures, checklist of requirements, fees, and standard processing times of Barangay Natumolan — compliant with Republic Act No. 7160 and Republic Act No. 11032 (Ease of Doing Business Act), featuring our Modernized Digital System Process Flow."
        />

        {/* Modernized System Process Flow Overview Banner */}
        <Reveal delay={0.04}>
          <div className="mb-10 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/10 p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <FiLayers className="h-3.5 w-3.5" /> E-Barangay Modernization
                </span>
                <h3 className="mt-2 text-xl font-bold text-dark sm:text-2xl">
                  Modernized Digital System Process Flow
                </h3>
              </div>
              <p className="max-w-md text-xs text-gray-500 sm:text-right sm:text-sm">
                Fast, paperless, and transparent. Residents can file requests online 24/7 or walk in directly at the Barangay Hall counter.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray/60 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                  1
                </div>
                <h4 className="text-sm font-bold text-dark">Online Filing / Counter Intake</h4>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  Submit requests via the Resident Portal from home or visit the counter. An instant transaction reference code is issued.
                </p>
              </div>

              <div className="rounded-xl border border-gray/60 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                  2
                </div>
                <h4 className="text-sm font-bold text-dark">Automated Registry Verification</h4>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  System automatically cross-checks the RBIM Population Registry masterlist and queues transactions in First-Come, First-Served order.
                </p>
              </div>

              <div className="rounded-xl border border-gray/60 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                  3
                </div>
                <h4 className="text-sm font-bold text-dark">Official Seal & Digital Approval</h4>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  The document is encoded with QR verification code and official barangay seal, then signed by the Punong Barangay / authorized official.
                </p>
              </div>

              <div className="rounded-xl border border-gray/60 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                  4
                </div>
                <h4 className="text-sm font-bold text-dark">Real-time Notification & Claiming</h4>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  Residents receive real-time SMS / email notifications once 'Ready to Claim'. Fast pickup at the counter and digital Customer Satisfaction Survey (CSS).
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Category Filter Tabs */}
        <Reveal delay={0.06}>
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            {CITIZENS_CHARTER_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              const count = cat.key
                ? CITIZENS_CHARTERS.filter((c) => c.category === cat.key).length
                : CITIZENS_CHARTERS.length;

              return (
                <button
                  key={cat.key || "all"}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  aria-pressed={isActive}
                  className={`cursor-pointer rounded-full px-5 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                    isActive
                      ? "bg-primary text-white shadow-md ring-2 ring-primary/30"
                      : "border border-gray/60 bg-white text-dark hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {cat.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle All controls */}
          <div className="mb-6 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing: <strong className="text-dark">{filteredCharters.length}</strong> of 7 Citizen's Charters
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={expandAll}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                Expand All
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="cursor-pointer font-medium text-gray-500 hover:text-dark hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>
        </Reveal>

        {/* Accordion List */}
        <div className="space-y-4">
          {filteredCharters.map((charter) => {
            const isOpen = openIds.has(charter.id);
            const action = getActionForCharter(charter.id);

            return (
              <Reveal key={charter.id} delay={0.02}>
                <div
                  className="overflow-hidden rounded-2xl border border-gray/70 bg-white shadow-xs transition-shadow hover:shadow-md"
                >
                  {/* Accordion Header / Trigger Button */}
                  <button
                    type="button"
                    onClick={() => toggleCharter(charter.id)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-gray-50/80 sm:p-6"
                  >
                    <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                      {/* Number badge */}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold tabular-nums text-primary sm:h-10 sm:w-10 sm:text-sm">
                        {charter.number}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-gray-600">
                            {charter.categoryLabel}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            charter.classification === "Simple"
                              ? "bg-green-100 text-green-700"
                              : charter.classification === "Complex"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {charter.classification}
                          </span>
                        </div>
                        <h3 className="mt-1 text-base font-bold text-dark sm:text-lg">
                          {charter.number}. {charter.title}
                        </h3>
                      </div>
                    </div>

                    {/* Right side stats + Arrow icon */}
                    <div className="flex shrink-0 items-center gap-3 sm:gap-6">
                      <div className="hidden text-right sm:block">
                        <div className="flex items-center justify-end gap-1 text-xs font-semibold text-dark">
                          <FiClock className="h-3.5 w-3.5 text-primary" /> {charter.totalTime}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[11px] text-gray-500">
                          <FiDollarSign className="h-3 w-3 text-emerald-600" /> {charter.totalFee}
                        </div>
                      </div>

                      {/* Arrow icon: Right when closed, Down when open */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors">
                        {isOpen ? (
                          <FiChevronDown className="h-5 w-5 text-primary" aria-hidden="true" />
                        ) : (
                          <FiChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isOpen && (
                    <div className="border-t border-gray/50 bg-white p-5 sm:p-8">
                      {/* Description */}
                      <div className="mb-6 rounded-xl bg-secondary/60 p-4 text-sm text-gray-700">
                        <p className="leading-relaxed">{charter.description}</p>
                      </div>

                      {/* Header Overview Card */}
                      <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray/60 bg-gray-50/70 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4 sm:text-sm">
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Office or Division
                          </span>
                          <span className="font-semibold text-dark">{charter.office}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Classification
                          </span>
                          <span className="font-semibold text-dark">{charter.classification}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Type of Transaction
                          </span>
                          <span className="font-semibold text-dark">{charter.typeOfTransaction}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Who May Avail
                          </span>
                          <span className="font-semibold text-dark">{charter.whoMayAvail}</span>
                        </div>
                      </div>

                      {/* System Process Flow for this Charter */}
                      <div className="mb-8 rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-primary sm:text-base">
                            <FiCheckCircle className="h-4 w-4" /> Integrated System Process Flow
                          </h4>
                          {action.url && (
                            <Link
                              to={action.url}
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark"
                            >
                              <span>{action.label}</span>
                              <FiExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {charter.systemProcessFlow.map((step) => (
                            <div key={step.step} className="rounded-lg border border-primary/10 bg-white p-3.5 text-xs shadow-2xs">
                              <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                Step {step.step}
                              </span>
                              <p className="mt-1 font-semibold text-dark">{step.title}</p>
                              <p className="mt-1 text-gray-500 leading-relaxed">{step.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Checklist of Requirements */}
                      <div className="mb-8">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dark">
                          <FiFileText className="h-4 w-4 text-primary" /> Checklist of Requirements
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-gray/70">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="border-b border-gray/60 bg-gray-100/80 font-bold uppercase tracking-wider text-gray-700">
                              <tr>
                                <th className="px-4 py-3 sm:px-6">Checklist of Requirements</th>
                                <th className="px-4 py-3 sm:px-6">Where to Secure</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray/50 bg-white">
                              {charter.requirements.map((req, i) => (
                                <tr key={i} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-3 font-medium text-dark sm:px-6">{req.requirement}</td>
                                  <td className="px-4 py-3 text-gray-600 sm:px-6">{req.whereToSecure}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Optional Fees Schedule */}
                      {charter.feesSchedule && charter.feesSchedule.length > 0 && (
                        <div className="mb-8">
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dark">
                            <FiDollarSign className="h-4 w-4 text-emerald-600" /> Schedule of Fees & Charges
                          </h4>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {charter.feesSchedule.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-lg border border-gray/60 bg-gray-50/70 p-3 text-xs"
                              >
                                <span className="font-medium text-dark">{f.item}</span>
                                <span className={`font-bold tabular-nums ${f.fee.includes("FREE") || f.fee.includes("NONE") ? "text-emerald-600" : "text-primary"}`}>
                                  {f.fee}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Step-by-Step Official Charter Table */}
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-dark">
                          <FiShield className="h-4 w-4 text-primary" /> Official Citizen's Charter Template Steps
                        </h4>
                        <div className="overflow-x-auto rounded-xl border border-gray/70">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="border-b border-gray/60 bg-gray-100/90 font-bold uppercase tracking-wider text-gray-700">
                              <tr>
                                <th className="w-12 px-3 py-3 text-center">#</th>
                                <th className="px-4 py-3 min-w-[180px]">Client Steps</th>
                                <th className="px-4 py-3 min-w-[220px]">Agency Actions</th>
                                <th className="px-4 py-3 min-w-[100px]">Fees to be Paid</th>
                                <th className="px-4 py-3 min-w-[120px]">Processing Time</th>
                                <th className="px-4 py-3 min-w-[160px]">Person Responsible</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray/50 bg-white">
                              {charter.steps.map((step) => (
                                <tr key={step.stepNumber} className="hover:bg-gray-50/50">
                                  <td className="px-3 py-3 text-center font-bold text-gray-500">
                                    {step.stepNumber}
                                  </td>
                                  <td className="px-4 py-3 font-medium text-dark">
                                    {step.clientStep}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {step.agencyAction}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-emerald-700">
                                    {step.fee}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 font-medium">
                                    {step.processingTime}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {step.personResponsible}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray/80 bg-gray-50 font-bold text-dark">
                              <tr>
                                <td colSpan={3} className="px-4 py-3.5 text-right uppercase tracking-wider text-xs">
                                  TOTAL:
                                </td>
                                <td className="px-4 py-3.5 text-emerald-700">
                                  {charter.totalFee}
                                </td>
                                <td className="px-4 py-3.5 text-primary">
                                  {charter.totalTime}
                                </td>
                                <td className="px-4 py-3.5 text-xs text-gray-500 font-normal">
                                  Compliant with RA 7160 and RA 11032
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Legal Basis Footer */}
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                          <FiInfo className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{charter.legalBasis}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
