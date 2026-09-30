import type { IconType } from "react-icons";
import {
  FaFileAlt,
  FaStamp,
  FaHome,
  FaHandHoldingHeart,
  FaBriefcase,
  FaFileSignature,
  FaComments,
  FaConciergeBell,
  FaShieldAlt,
} from "react-icons/fa";

export interface Service {
  id: number;
  name: string;
  description: string;
  icon: IconType;
  /**
   * A service somebody can START from the website, rather than only read
   * about.
   *
   * A KP complaint can be begun online; so can a VAWC complaint and a
   * certificate request by a registered resident (with their Resident ID,
   * no account needed) — each card is where somebody looking for it
   * actually is. Everything else on this list is a counter visit, and
   * a button implying otherwise would send people to a page that could not
   * help them.
   */
  action?: { label: string; to: string };
}

export const services: Service[] = [
  {
    id: 1,
    name: "Barangay Certificate",
    description:
      "General-purpose certification issued to residents for employment, school, and other legal requirements.",
    icon: FaFileAlt,
    action: { label: "Request online (residents)", to: "/request-certificate" },
  },
  {
    id: 2,
    name: "Barangay Clearance",
    description:
      "Certifies that a resident has no pending case or derogatory record within the barangay.",
    icon: FaStamp,
    action: { label: "Request online (residents)", to: "/request-certificate?type=Barangay%20Clearance" },
  },
  {
    id: 3,
    name: "Certificate of Residency",
    description:
      "Official proof that an individual is a bona fide resident of Barangay Natumolan.",
    icon: FaHome,
    action: { label: "Request online (residents)", to: "/request-certificate?type=Certificate%20of%20Residency" },
  },
  {
    id: 4,
    name: "Certificate of Indigency",
    description:
      "Issued to qualified low-income residents for medical, educational, and legal assistance.",
    icon: FaHandHoldingHeart,
    action: { label: "Request online (residents)", to: "/request-certificate?type=Certificate%20of%20Indigency" },
  },
  {
    id: 5,
    name: "Business Clearance",
    description:
      "A requirement for new and renewing businesses operating within the barangay's jurisdiction.",
    icon: FaBriefcase,
    action: { label: "Request online (residents)", to: "/request-certificate?type=Business%20Barangay%20Clearance" },
  },
  {
    id: 6,
    name: "Barangay Permit",
    description:
      "Permits for events, construction, and other activities conducted within the barangay.",
    icon: FaFileSignature,
  },
  {
    id: 8,
    name: "Complaints",
    description:
      "File complaints and grievances for mediation through the Lupon Tagapamayapa.",
    icon: FaComments,
    action: { label: "File a complaint online", to: "/file-complaint" },
  },
  {
    id: 10,
    name: "VAWC Online Complaint",
    description:
      "Violence against women and their children — sent in confidence to the Barangay VAW Desk. For registered residents, verified with the Barangay Resident ID.",
    icon: FaShieldAlt,
    action: { label: "File a VAWC complaint online", to: "/vawc-complaint" },
  },
  {
    id: 9,
    name: "Other Barangay Services",
    description:
      "Health services, youth programs, community activities, and more assistance for residents.",
    icon: FaConciergeBell,
  },
];
