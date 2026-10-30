export interface CharterRequirement {
  requirement: string;
  whereToSecure: string;
}

export interface CharterStep {
  stepNumber: number;
  clientStep: string;
  agencyAction: string;
  fee: string;
  processingTime: string;
  personResponsible: string;
}

export interface FeeItem {
  item: string;
  fee: string;
}

export interface SystemProcessStep {
  step: string;
  title: string;
  description: string;
}

export interface CitizensCharterItem {
  id: string;
  number: string;
  category: "Clearance" | "Certification" | "Lupon" | "VAWC" | "Resolution" | "CTC" | "Services";
  categoryLabel: string;
  title: string;
  description: string;
  office: string;
  classification: "Simple" | "Complex" | "Highly Technical";
  typeOfTransaction: "G2C – Government to Citizen" | "G2C – Government to Client" | "G2B – Government to Business" | "G2G – Government to Government" | "G2G / G2C – Government to Government / Citizen" | string;
  whoMayAvail: string;
  legalBasis: string;
  systemProcessFlow: SystemProcessStep[];
  requirements: CharterRequirement[];
  feesSchedule?: FeeItem[];
  steps: CharterStep[];
  totalFee: string;
  totalTime: string;
}

export const CITIZENS_CHARTER_CATEGORIES = [
  { key: "", label: "All" },
  { key: "Clearance", label: "Barangay Clearance" },
  { key: "Certification", label: "Barangay Certification" },
  { key: "Lupon", label: "Katarungang Pambarangay (Lupon)" },
  { key: "VAWC", label: "Barangay Protection Order (VAWC)" },
  { key: "Resolution", label: "Barangay Resolution" },
  { key: "CTC", label: "Community Tax Certificate (CTC)" },
  { key: "Services", label: "Barangay Services & Requests" },
] as const;

export const CITIZENS_CHARTERS: CitizensCharterItem[] = [
  // 01. Filling of Complaints for Amicable Settlement
  {
    id: "01-amicable-settlement",
    number: "01",
    category: "Lupon",
    categoryLabel: "Katarungang Pambarangay (Lupon)",
    title: "Filing of Complaints for Amicable Settlement",
    description:
      "This service caters to provide a way for residents to resolve disputes peacefully within the barangay. This process helps the parties involved to reach an agreement or understanding without having to go to court, promoting harmony and cooperation in the community.",
    office: "Office of the Barangay (Katarungang Pambarangay / Lupon Tagapamayapa)",
    classification: "Highly Technical",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "ALL (Residents and parties involved in disputes within Barangay Natumolan jurisdiction)",
    legalBasis: "Service is covered under Republic Act No. 7160 (Local Government Code of 1991).",
    systemProcessFlow: [
      {
        step: "1",
        title: "Online Complaint Filing / Counter Intake",
        description:
          "Complainants can file 24/7 through the Resident Portal (File Complaint) from home or walk in at the Barangay Hall where the Lupon Clerk records the complaint details.",
      },
      {
        step: "2",
        title: "Automated Docketing & Fee Recording",
        description:
          "The system automatically assigns a unique KP Case Docket Number (e.g., 2026-XX-XX-XX) and records the filing fee official receipt (₱20.00).",
      },
      {
        step: "3",
        title: "Digital Summons & Hearing Scheduling",
        description:
          "The Secretary issues formal summons to the respondent. Hearing dates are registered in the calendar with real-time status tracking.",
      },
      {
        step: "4",
        title: "Mediation Session & Settlement Recording",
        description:
          "The Punong Barangay conducts mediation proceedings. Upon mutual agreement, the Amicable Settlement is digitally archived and signed in the KP logbook.",
      },
      {
        step: "5",
        title: "Digital Customer Satisfaction Survey (CSS)",
        description:
          "Upon completion, clients accomplish the Customer Satisfaction Survey directly on their portal dashboard or drop it into the feedback drop box.",
      },
    ],
    requirements: [
      {
        requirement: "Complaint's Form (1 original copy)",
        whereToSecure: "Barangay Hall / Resident Portal (Digital Complaint Form)",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the Complaint's Form",
        agencyAction: "Check, receive and record the request (in-person or via Resident Portal docket queue)",
        fee: "None",
        processingTime: "3 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 2,
        clientStep: "Payment of Filing fee",
        agencyAction: "Issuance of Official Receipt",
        fee: "₱20.00",
        processingTime: "2 minutes",
        personResponsible: "Barangay Treasurer / Barangay Clerk",
      },
      {
        stepNumber: 3,
        clientStep: "Waiting for hearing",
        agencyAction: "Issuance of Summons to Defendant and calendar docket entry",
        fee: "None",
        processingTime: "Next working Day",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 4,
        clientStep: "Attend Hearing",
        agencyAction: "Mediation proceedings conducted by the Punong Barangay",
        fee: "None",
        processingTime: "Not later than 5 days",
        personResponsible: "Punong Barangay",
      },
      {
        stepNumber: 5,
        clientStep: "Sign the KP Logbook",
        agencyAction: "Prepare and execute the Amicable Settlement agreement",
        fee: "None",
        processingTime: "After 15 days",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 6,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction: "Request the client to accomplish the CSS and drop it in the Drop Box for Feedback (or submit online)",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
    ],
    totalFee: "₱20.00",
    totalTime: "21 days and 10 minutes",
  },

  // 02. Filing of Complaints for Certificate to File Action
  {
    id: "02-file-action",
    number: "02",
    category: "Lupon",
    categoryLabel: "Katarungang Pambarangay (Lupon)",
    title: "Filing of Complaints for Certificate to File Action",
    description:
      "This service caters to provide official proof that efforts to resolve a dispute through amicable settlement at the barangay level have failed. This certificate allows the complainant to pursue their case in court or with the appropriate government agency, ensuring that all attempts for a peaceful resolution have been tried before taking legal action.",
    office: "Office of the Barangay (Lupon Tagapamayapa / Pangkat ng Tagapagsundo)",
    classification: "Highly Technical",
    typeOfTransaction: "G2C – Government to Client",
    whoMayAvail: "ALL (Complainants with disputes where barangay conciliation/mediation has failed)",
    legalBasis: "Service is covered under Republic Act No. 7160 (Katarungang Pambarangay Law).",
    systemProcessFlow: [
      {
        step: "1",
        title: "Requirement Submission & Verification",
        description:
          "Submit the complaint along with police blotter or supporting agreements. Each transaction is digitally tracked in the Lupon Case Docket.",
      },
      {
        step: "2",
        title: "Mediation at Punong Barangay Level",
        description:
          "Mediation hearing is conducted within 5 days. If no settlement is reached, the Pangkat ng Tagapagsundo is constituted within 3 days.",
      },
      {
        step: "3",
        title: "Conciliation by Pangkat ng Tagapagsundo",
        description:
          "Formal conciliation session (45 minutes). If both parties fail to reach an amicable agreement, the failure is formally documented in the docket.",
      },
      {
        step: "4",
        title: "Issuance of Certificate to File Action (CFA)",
        description:
          "The system prepares the official Certificate to File Action (KP Form 20) with system series number and QR verification seal, signed by the Pangkat Secretary and Punong Barangay.",
      },
    ],
    requirements: [
      {
        requirement: "Complaint Form (1 Original Copy)",
        whereToSecure: "Barangay Hall / Resident Portal",
      },
      {
        requirement: "Police Blotter (1 photocopy with 1 Original Copy to be presented upon submission)",
        whereToSecure: "Philippine National Police (PNP)",
      },
      {
        requirement: "Medical Certificate (for Physical Injury complaints — 1 photocopy with 1 Original Copy)",
        whereToSecure: "Rural Health Unit (RHU) / Hospital",
      },
      {
        requirement: "Contract of Agreement (for Collection of Sum of Money complaints — 1 photocopy)",
        whereToSecure: "Client / Concerned Parties",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the Complaint Form with the Requirements",
        agencyAction: "1.1 Check, receive and record the complaint form with complete requirements; 1.2 Issue summons to defendant",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 2,
        clientStep: "Attend hearing (Mediation)",
        agencyAction: "1.1 Mediation; 1.2 No Settlement; 1.3 Constitute Pangkat ng Tagapagsundo",
        fee: "None",
        processingTime: "Not later than 5 Days (Mediation), Not later than 3 Days (Constitute Pangkat)",
        personResponsible: "Barangay Secretary / Punong Barangay",
      },
      {
        stepNumber: 3,
        clientStep: "Attend hearing (Conciliation)",
        agencyAction: "1.1 Conciliation proceedings; 1.2 Record No Settlement; 1.3 Endorse for Certificate to File Action",
        fee: "None",
        processingTime: "45 Minutes",
        personResponsible: "Pangkat ng Tagapagsundo",
      },
      {
        stepNumber: 4,
        clientStep: "Get the Certification",
        agencyAction: "Issuance of Certificate to File Action with official series number and seal",
        fee: "₱230.00",
        processingTime: "5 Minutes",
        personResponsible: "Lupon Pangkat Secretary",
      },
    ],
    totalFee: "₱230.00",
    totalTime: "8 days and 50 minutes",
  },

  // 03. Issuance of Agreement
  {
    id: "03-issuance-agreement",
    number: "03",
    category: "Lupon",
    categoryLabel: "Katarungang Pambarangay (Lupon)",
    title: "Issuance of Agreement",
    description:
      "This service issues the agreement certificate to facilitate the personal transactions of both parties.",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "All Solo Parents within Area of Responsibility / Concerned Parties with bilateral mutual agreements",
    legalBasis: "Service is covered under Republic Act No. 7160.",
    systemProcessFlow: [
      {
        step: "1",
        title: "Intake & Ownership Document Validation",
        description:
          "Both parties present themselves at the Barangay Hall or submit mutual agreement proofs online through the portal.",
      },
      {
        step: "2",
        title: "System Preparation of Agreement Certificate",
        description:
          "The Secretary encodes agreement specifications into the system, producing 3 standardized official copies and digital record archiving.",
      },
      {
        step: "3",
        title: "Signing & Mutual Release",
        description:
          "Both parties execute signatures on the 3 official copies before the authorized barangay official and receive their certified copies.",
      },
      {
        step: "4",
        title: "Customer Satisfaction Survey (CSS)",
        description:
          "Feedback is collected online or dropped in the feedback drop box to ensure quality service delivery.",
      },
    ],
    requirements: [
      {
        requirement: "Ownership Document (1 original to be presented, 1 photocopy)",
        whereToSecure: "Both parties",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Proceed to the Barangay Hall for Interview and sign in the logbook",
        agencyAction:
          "1.1 Check, Receive and Record the requirements (both parties present with Ownership Document - 10 mins); 1.2 Prepare the agreement certificate to be signed by both parties (5 mins)",
        fee: "None",
        processingTime: "15 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 2,
        clientStep: "Sign the 3 copies of agreement certificate",
        agencyAction: "Release and provide the signed agreement certificate to both parties",
        fee: "None",
        processingTime: "2 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 3,
        clientStep: "Received the Agreement",
        agencyAction: "Releasing of official Agreement Certificate",
        fee: "None",
        processingTime: "2 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 4,
        clientStep: "Accomplish the client satisfaction survey (CSS)",
        agencyAction: "Request client to accomplish the client satisfaction survey (CSS) and drop in Feedback Drop box (or portal)",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "24 minutes",
  },

  // 04. Issuance of Barangay Certification
  {
    id: "04-barangay-certification",
    number: "04",
    category: "Certification",
    categoryLabel: "Barangay Certification",
    title: "Issuance of Barangay Certification",
    description:
      "This service assists clients in issuing identification documents essential for various important business, job or personal transactions.",
    office: "Office of the Barangay (Main Office & Records Division)",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "Barangay Natumolan Residents",
    legalBasis: "Service is covered under Republic Act No. 7160 and Republic Act No. 11261 (First Time Jobseekers Assistance Act).",
    systemProcessFlow: [
      {
        step: "1",
        title: "Online Filing via Resident Portal or Counter",
        description:
          "Residents choose their specific certificate type (Residency, Indigency, Late Birth, Titling, etc.) and state the purpose online 24/7 without waiting in physical queues.",
      },
      {
        step: "2",
        title: "Automated Population Registry Verification",
        description:
          "The system immediately cross-checks the applicant against the RBIM Census Masterlist, confirming residency, address, and Purok/Zone credentials.",
      },
      {
        step: "3",
        title: "Digital Processing & Barangay Seal",
        description:
          "The document is formatted with official serial numbering and official seal, submitted for signature by the Punong Barangay or Officer-in-Charge.",
      },
      {
        step: "4",
        title: "Real-time Notification & Express Pickup",
        description:
          "Residents receive an automated SMS/email and portal notification when 'Ready to Claim'. Pickup is fast and verified with official receipt.",
      },
      {
        step: "5",
        title: "Digital Customer Satisfaction Survey (CSS)",
        description:
          "Rate and review the service easily through the portal feedback module or in the Barangay Hall drop box.",
      },
    ],
    requirements: [
      {
        requirement: "Request form (1 Original Copy)",
        whereToSecure: "Barangay Hall / Resident Portal (Automated Online Request)",
      },
    ],
    feesSchedule: [
      { item: "Certification of Late Birth Registration", fee: "₱70.00" },
      { item: "Certification for Titling", fee: "₱130.00" },
      { item: "Certification for Residency", fee: "₱70.00" },
      { item: "Certification Affidavit of Loss", fee: "₱80.00" },
      { item: "Certification Has Business / Income", fee: "₱80.00" },
      { item: "Transport of Animals: Pig and Goat (per head)", fee: "₱80.00" },
      { item: "Transport of Animals: Cow, Carabao and Horse (per head)", fee: "₱80.00" },
      { item: "Garage: Residential", fee: "₱130.00" },
      { item: "Garage: Commercial", fee: "₱530.00" },
      { item: "Other Certification Fees", fee: "₱60.00" },
      { item: "Certification of Common-Law", fee: "FREE / NONE" },
      { item: "Certification of Oneness", fee: "FREE / NONE" },
      { item: "Certification of Attestation", fee: "FREE / NONE" },
      { item: "Certification of Oath of Undertaking", fee: "FREE / NONE" },
      { item: "Certification of Indigency", fee: "FREE / NONE" },
      { item: "Certification for First Time Job Seeker (RA 11261)", fee: "FREE / NONE" },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the request form (Online via Portal or Walk-in)",
        agencyAction:
          "1.1 Check, receive and record request (5 mins); 1.2 Prepare Barangay Certification, print and affix Official Seal (10 mins); 1.3 Sign the Barangay Certification (10 mins)",
        fee: "None",
        processingTime: "25 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk / Punong Barangay or SB Member Officer In-Charge",
      },
      {
        stepNumber: 2,
        clientStep: "Pay the fees for the Barangay Certification according to purpose and request Official Receipt",
        agencyAction: "Issued an Official Receipt according to its purpose (Exempt for Indigency & First Time Jobseekers)",
        fee: "According to purpose (₱0.00 – ₱530.00)",
        processingTime: "10 minutes",
        personResponsible: "Barangay Treasurer / Barangay Clerk / Barangay Record Keeper",
      },
      {
        stepNumber: 3,
        clientStep: "Receive the Barangay Certification",
        agencyAction: "Release the official Barangay Certification",
        fee: "None",
        processingTime: "2 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk",
      },
      {
        stepNumber: 4,
        clientStep: "Accomplish the Client Satisfaction Survey (CSS)",
        agencyAction: "Request client to accomplish CSS in feedback drop box or directly in the Resident Portal",
        fee: "None",
        processingTime: "3 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk",
      },
    ],
    totalFee: "Dependent on purpose (Free up to ₱530.00)",
    totalTime: "40 minutes",
  },

  // 05. Issuance of Barangay Clearance
  {
    id: "05-barangay-clearance",
    number: "05",
    category: "Clearance",
    categoryLabel: "Barangay Clearance",
    title: "Issuance of Barangay Clearance",
    description:
      "This service assists clients in issuing identification documents essential for various important business, job or personal transactions.",
    office: "Office of the Barangay (Main Office)",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "Barangay Natumolan Residents",
    legalBasis: "Service is covered under Republic Act No. 7160 (Local Government Code of 1991).",
    systemProcessFlow: [
      {
        step: "1",
        title: "24/7 Online Application via Portal",
        description:
          "Select the purpose (Employment, ID, Loan, Driver's License, Abroad, etc.) on the Resident Portal or visit the counter. The system generates an instant transaction code.",
      },
      {
        step: "2",
        title: "Digital Registry & Records Cross-Check",
        description:
          "The system verifies the resident record, confirming active registration and ensuring no pending dispute hold or administrative blocker.",
      },
      {
        step: "3",
        title: "Document Generation & Official Seal",
        description:
          "The Clerk produces the clearance with official serial number and QR verification seal, signed by the Punong Barangay or Officer of the Day.",
      },
      {
        step: "4",
        title: "SMS & Portal Notification / Fast Counter Pickup",
        description:
          "Residents receive SMS/portal notification once ready. Present the transaction code at the counter, pay the corresponding fee with Official Receipt, and claim the document.",
      },
      {
        step: "5",
        title: "Customer Satisfaction Survey (CSS)",
        description:
          "Accomplish the customer feedback ratings seamlessly through the portal or physical drop box.",
      },
    ],
    requirements: [
      {
        requirement: "Request form (1 Original Copy)",
        whereToSecure: "Barangay Hall / Resident Portal (Online Request System)",
      },
    ],
    feesSchedule: [
      { item: "Employment", fee: "₱60.00" },
      { item: "Identification (ID)", fee: "₱60.00" },
      { item: "Loan Requirement", fee: "₱70.00" },
      { item: "Motor Instalment", fee: "₱60.00" },
      { item: "Police Clearance", fee: "₱60.00" },
      { item: "Drivers' License", fee: "₱60.00" },
      { item: "Abroad (Travel / Work)", fee: "₱130.00" },
      { item: "Avon / Personal Collection Dealers", fee: "₱60.00" },
      { item: "SSS / PAG-IBIG", fee: "₱60.00" },
      { item: "Water Installation", fee: "₱60.00" },
      { item: "Bank Requirement", fee: "₱60.00" },
      { item: "PhilHealth", fee: "₱60.00" },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the request form (Online or Walk-in)",
        agencyAction:
          "1.1 Check, receive and record the request (5 mins); 1.2 Prepare Barangay Clearance, print and affix Official Barangay Seal (10 mins); 1.3 Sign the Barangay Clearance (10 mins)",
        fee: "None",
        processingTime: "25 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk / Punong Barangay or SB Member Officer of the Day",
      },
      {
        stepNumber: 2,
        clientStep: "Pay the fees for Barangay Clearance according to purpose and request Official Receipt",
        agencyAction: "Issued an Official Receipt according to the purpose",
        fee: "₱60.00 – ₱130.00",
        processingTime: "10 minutes",
        personResponsible: "Barangay Treasurer / Barangay Recordkeeper / Barangay Clerk",
      },
      {
        stepNumber: 3,
        clientStep: "Receive the Barangay Clearance",
        agencyAction: "Release the Barangay Clearance",
        fee: "None",
        processingTime: "2 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk",
      },
      {
        stepNumber: 4,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction: "Request client to accomplish CSS and drop in Feedback Drop box (or submit online)",
        fee: "None",
        processingTime: "3 minutes",
        personResponsible: "Barangay Secretary / Barangay Clerk",
      },
    ],
    totalFee: "₱60.00 to ₱130.00",
    totalTime: "40 minutes",
  },

  // 06. Issuance of Barangay Protection Order
  {
    id: "06-vawc-bpo",
    number: "06",
    category: "VAWC",
    categoryLabel: "Barangay Protection Order (VAWC)",
    title: "Issuance of Barangay Protection Order (BPO)",
    description:
      "This service caters the request of the clients to prevent further acts of violence against women or her child and to safeguard the victim from harm. This involves the assessment of the victims conducted by the trained Barangay Violence Against Women and Children (VAWC) Desk Officer. The respondent will receive the Barangay Protection Order issued.",
    office: "Office of the Barangay (Violence Against Women and Children / VAWC Desk)",
    classification: "Complex",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail:
      "Women and their children who are victims of violence under Republic Act No. 9262: The wife or former wife; Girlfriend or Ex-Girlfriend; Children (legitimate or illegitimate, within or outside the household).",
    legalBasis: "Republic Act No. 9262 (Anti-Violence Against Women and Their Children Act of 2004).",
    systemProcessFlow: [
      {
        step: "1",
        title: "Confidential Online Report or Direct Walk-in",
        description:
          "Submit a secure and confidential report through the Resident Portal (VAWC Incident Report) or approach the VAWC Desk Officer in complete privacy at the Barangay Hall.",
      },
      {
        step: "2",
        title: "Urgent Assessment & Digital Intake",
        description:
          "The trained VAWC Desk Officer immediately interviews the victim, completes the official Intake Form, and ensures prioritized safety safeguards.",
      },
      {
        step: "3",
        title: "Preparation & Signing of Barangay Protection Order (BPO)",
        description:
          "The BPO is prepared within 10 minutes and promptly signed by the Punong Barangay or Officer of the Day (5 minutes).",
      },
      {
        step: "4",
        title: "Serving the Order to Respondent",
        description:
          "The VAWC Desk Officer accompanied by Barangay Tanod serves the Barangay Protection Order to the respondent within 1 hour.",
      },
      {
        step: "5",
        title: "Confidential Follow-up & Feedback",
        description:
          "Continued protection monitoring and confidential feedback submission through the portal or secure drop box.",
      },
    ],
    requirements: [
      {
        requirement: "Police Blotter (1 original copy to be presented, 1 photocopy)",
        whereToSecure: "Philippine National Police (PNP)",
      },
      {
        requirement: "Medical Certificate to be presented (for Physical Injury — 1 original copy)",
        whereToSecure: "Rural Health Unit (RHU) / Hospital",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the Requirements (Confidential Intake / Online Report)",
        agencyAction:
          "1.1 Conduct assessment thru Interview and accomplish the Intake Form (10 mins); 1.2 Prepare the Barangay Protection Order based on Intake Form (10 mins); 1.3 Sign the Barangay Protection Order (5 mins)",
        fee: "None (Exempt under RA 9262)",
        processingTime: "25 minutes",
        personResponsible: "Barangay VAWC Desk Officer / Punong Barangay or SB Member Officer of the Day",
      },
      {
        stepNumber: 2,
        clientStep: "Receive a copy of the Barangay Protection Order",
        agencyAction: "Serve the Barangay Protection Order to the respondent",
        fee: "None",
        processingTime: "1 hour",
        personResponsible: "Barangay VAWC Desk Officer and Barangay Tanod",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction: "Request client to accomplish the CSS and drop it in the Drop Box for Feedback (or confidential portal)",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay VAWC Desk Officer",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "1 hour and 30 minutes",
  },

  // 07. Issuance of Barangay Resolution
  {
    id: "07-barangay-resolution",
    number: "07",
    category: "Resolution",
    categoryLabel: "Barangay Resolution",
    title: "Issuance of Barangay Resolution",
    description:
      "This service issued by a barangay resolution indicating that it has no opposition to a proposed project or activity related to the extraction, processing, or use of sand and gravel and new projects. It includes evaluation and ocular inspection for environmental and economic considerations and public consultation by the Sangguniang Barangay.",
    office: "Office of the Barangay (Sangguniang Barangay Legislative Division)",
    classification: "Highly Technical",
    typeOfTransaction: "G2B – Government to Business",
    whoMayAvail: "Concessionaires / Operators / Proponents of development and resource projects",
    legalBasis: "Sangguniang Barangay Regular Legislative Session Procedures & Environmental Guidelines.",
    systemProcessFlow: [
      {
        step: "1",
        title: "Formal Letter of Intent & Document Submission",
        description:
          "Proponents submit complete environmental compliance certificates, site development plans, and clearances to the Sangguniang Barangay office.",
      },
      {
        step: "2",
        title: "First Reading in Regular Legislative Session",
        description:
          "The Secretary schedules the proposed resolution on the regular session agenda for First Reading within 2 weeks.",
      },
      {
        step: "3",
        title: "Ocular Inspection & Joint Committee Review",
        description:
          "Ocular site inspection is conducted with MENRO, PENRO, and Solid Waste Management committees to assess environmental safety.",
      },
      {
        step: "4",
        title: "Second & Third Reading / Final Council Enactment",
        description:
          "Formal council deliberation, voting, and enactment of the Resolution of No Objection.",
      },
      {
        step: "5",
        title: "Official Digital Release & Archive",
        description:
          "Release of the certified true copy of the enacted resolution with official legislative series tracking.",
      },
    ],
    requirements: [
      {
        requirement: "Letter of Intent (1 Original Copy)",
        whereToSecure: "Client / Proponent",
      },
      {
        requirement: "Site Development Plan (1 photocopy)",
        whereToSecure: "Client / Engineer",
      },
      {
        requirement: "Environmental Compliance Certificate (ECC) or Certificate of Non-Coverage (CNC) (1 photocopy)",
        whereToSecure: "DENR EMB-10",
      },
      {
        requirement: "Proof of Ownership (1 photocopy)",
        whereToSecure: "Client",
      },
      {
        requirement: "Clearance for Sand and Gravel (1 original copy to be presented, 1 photocopy)",
        whereToSecure:
          "DPWH Regional Office (projects costing 100M up) / DPWH District Office (projects costing 100M below) / NGCP Iligan",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the requirements",
        agencyAction:
          "1.1 Check and receive complete requirements (10 mins); 1.2 Schedule for first reading during regular session (within 2 weeks); 1.3 Conduct first reading with minutes of regular session (4 hours); 1.4 Schedule for ocular inspection (within 1 week); 1.5 Conduct Ocular Inspection and prepare findings/recommendations (1 Day); 1.6 Conduct second and third reading with minutes of regular session (2 weeks)",
        fee: "None",
        processingTime: "~36 days total",
        personResponsible: "Sangguniang Barangay Members, Barangay Secretary, MENRO, PENRO, Solid Waste Management",
      },
      {
        stepNumber: 2,
        clientStep: "Receive the Resolution of No Objection",
        agencyAction: "Release the Approved Resolution of No Objection signed by the Sangguniang Barangay",
        fee: "None",
        processingTime: "1 day",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Client Satisfaction Survey (CSS)",
        agencyAction: "Request client to accomplish client satisfaction survey (CSS) and drop in Feedback Drop box",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "37 days and 15 minutes",
  },

  // 08. Issuance of Community Tax Certificate
  {
    id: "08-community-tax-certificate",
    number: "08",
    category: "CTC",
    categoryLabel: "Community Tax Certificate (CTC)",
    title: "08. Issuance of Community Tax Certificate",
    description:
      "This service caters the request of the clients as proof of identification, verifying a person's tax and personal details for legal and administrative processes and is required for signing contracts, and applying for government permits and licenses.",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail:
      "1. Residents of the Philippines at least 18 years of age and above; 2. Employed individuals, self-employed individuals, or professionals",
    legalBasis: "Republic Act No. 7160 (Local Government Code of 1991), Chapter 2, Section 156",
    systemProcessFlow: [
      {
        step: "Step 1",
        title: "Requirement Submission & Assessment",
        description:
          "Client submits previous CTC or government-issued valid ID. The Barangay Treasurer/Clerk assesses basic and additional community tax based on declared gross income/earnings.",
      },
      {
        step: "Step 2",
        title: "CTC Encoding & Receipt Issuance",
        description:
          "Official Community Tax Certificate details and tax computations are encoded into the system and official receipt is generated.",
      },
      {
        step: "Step 3",
        title: "Signing, Thumbmark & Document Release",
        description:
          "Client affixes signature and right thumbmark on the official CTC copy; document is signed and officially released.",
      },
    ],
    requirements: [
      {
        requirement: "For clients with Previous CTC: Previous CTC (1 original or 1 photocopy)",
        whereToSecure: "Client",
      },
      {
        requirement:
          "For clients without Previous CTC: Any issued valid ID to be presented as proof of identity and residency (1 original copy) (e.g. BIR, Postal ID, Voter's ID, Driver's License, GSIS, SSS, PhilHealth, National ID, School ID, Employee ID, Senior Citizen, PWD)",
        whereToSecure: "Issuing Government Agency / School / Employer",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the requirement",
        agencyAction:
          "1.1 Check and receive the requirement (2 mins); 1.2 Fill-up the CTC form based on information provided by the client (3 mins); 1.3 Compute the fees to be paid and advise client to pay (3 mins)",
        fee: "Per R.A. 7160 Chapter 2, Section 156",
        processingTime: "8 minutes",
        personResponsible: "Barangay Treasurer / Barangay Clerk",
      },
      {
        stepNumber: 2,
        clientStep: "Pay the fees, sign and receive the CTC",
        agencyAction: "Receive the payment and release the CTC",
        fee: "None (Included in assessed tax)",
        processingTime: "2 minutes",
        personResponsible: "Barangay Treasurer / Barangay Clerk",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction:
          "Request client to accomplish the client satisfaction survey (CSS) and to be dropped in the Drop box for Feedback placed at the Barangay Hall",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Treasurer / Barangay Clerk",
      },
    ],
    totalFee: "Per R.A. 7160 Chapter 2, Section 156",
    totalTime: "15 minutes",
  },

  // 09. Request for Repair and Maintenance of Streetlights (Minor Repair)
  {
    id: "09-repair-maintenance-streetlights",
    number: "09",
    category: "Services",
    categoryLabel: "Barangay Services & Requests",
    title: "09. Request for Repair and Maintenance of Streetlights (Minor Repair)",
    description:
      "This service includes minor repairs, such as replacing busted bulbs and starters, to cater to the client's request for repair and maintenance of community streetlights.",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "Resident within the Barangay",
    legalBasis: "Barangay Public Safety, Infrastructure Maintenance & Security Policies",
    systemProcessFlow: [
      {
        step: "Step 1",
        title: "Request Filing & Electrician Dispatch",
        description:
          "Resident submits the streetlight repair request. Secretary logs the request and notifies the Barangay Electrician for on-site inspection.",
      },
      {
        step: "Step 2",
        title: "On-Site Inspection & Minor Repair",
        description:
          "Barangay Electrician inspects the streetlight location and conducts minor repair or replaces busted bulbs and wires.",
      },
      {
        step: "Step 3",
        title: "Completion Acknowledgment & Feedback",
        description:
          "Electrician informs the resident and barangay of the completed repair; satisfaction survey is accomplished.",
      },
    ],
    requirements: [
      {
        requirement: "Request Form (1 original copy)",
        whereToSecure: "Client / Barangay Hall",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit accomplished request form to the Office of the Punong Barangay",
        agencyAction:
          "1.1 Check, receive and record the request (3 mins, Secretary); 1.2 Advise the barangay electrician to inspect the streetlights (2 mins, Secretary); 1.3 Inspect the streetlights (1 hour, Electrician); 1.4 Conduct the minor repair or replace the busted bulbs or wires (1 hour, Electrician)",
        fee: "None",
        processingTime: "2 hours & 5 minutes",
        personResponsible: "Barangay Secretary, Barangay Electrician",
      },
      {
        stepNumber: 2,
        clientStep: "Acknowledge the completed request",
        agencyAction: "Notify the client and acknowledge the completed request",
        fee: "None",
        processingTime: "30 minutes",
        personResponsible: "Barangay Electrician",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction:
          "Request client to accomplish the Client Satisfaction Survey (CSS) and to be dropped in the Drop box for Feedback placed at the Barangay Hall",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Electrician",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "2 hours & 40 minutes",
  },

  // 10. Request for Travel Order
  {
    id: "10-request-travel-order",
    number: "10",
    category: "Services",
    categoryLabel: "Barangay Services & Requests",
    title: "10. Request for Travel Order",
    description:
      "This service issues travel orders to barangay officials, employees and volunteers for official business with budget allocation identifying the travel purpose which includes necessary financial information for budgetary and reimbursement purposes.",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2G – Government to Government",
    whoMayAvail: "Within Area of Responsibility (Barangay Officials, Employees, and Volunteers)",
    legalBasis: "DILG & COA Guidelines on Official Travel & Local Governance Administration",
    systemProcessFlow: [
      {
        step: "Step 1",
        title: "Invitation / Memo Submission & Verification",
        description:
          "Requesting official/employee presents the written invitation or training memo. Secretary logs the official travel itinerary.",
      },
      {
        step: "Step 2",
        title: "Travel Order Encoding & Punong Barangay Approval",
        description:
          "Barangay Treasurer prepares the Travel Order with budget allocation details. Punong Barangay reviews and signs.",
      },
      {
        step: "Step 3",
        title: "Release of Official Travel Order",
        description:
          "Treasurer officially releases signed copies for travel and reimbursement records.",
      },
    ],
    requirements: [
      {
        requirement: "Written Invitation or Memorandum (1 photocopy)",
        whereToSecure: "Requesting Agency / Organizer / DILG",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the invitation or memorandum",
        agencyAction:
          "1.1 Check, receive, and record the invitation or memorandum (5 mins, Secretary); 1.2 Prepare the Travel Order (10 mins, Treasurer); 1.3 Sign the Travel Order (5 mins, Punong Barangay)",
        fee: "None",
        processingTime: "20 minutes",
        personResponsible: "Barangay Secretary, Barangay Treasurer, Punong Barangay",
      },
      {
        stepNumber: 2,
        clientStep: "Receive the Travel Order",
        agencyAction: "Release the Travel Order",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Treasurer",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction:
          "Request the client to accomplish the Customer Satisfaction Survey (CSS) and drop it in the Drop Box for Feedback",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Treasurer",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "30 minutes",
  },

  // 11. Issuance of Affidavit for Solo Parent
  {
    id: "11-affidavit-solo-parent",
    number: "11",
    category: "Certification",
    categoryLabel: "Barangay Certification",
    title: "11. Issuance of Affidavit for Solo Parent",
    description:
      "This service issues an affidavit for solo parents as one of the requirements for application of solo parent ID to be processed by the Municipal Social Welfare and Development Office (MSWDO).",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2C – Government to Citizen",
    whoMayAvail: "All Solo Parents within Area of Responsibility",
    legalBasis: "Republic Act No. 8972 as amended by Republic Act No. 11861 (Expanded Solo Parents Welfare Act)",
    systemProcessFlow: [
      {
        step: "Step 1",
        title: "Interview & Population Register Verification",
        description:
          "Solo parent client undergoes interview with Barangay Secretary; family details and solo parent status are verified on the register.",
      },
      {
        step: "Step 2",
        title: "Affidavit Preparation & Executive Signature",
        description:
          "Barangay Secretary drafts the official Affidavit for Solo Parent; Punong Barangay signs the legal instrument.",
      },
      {
        step: "Step 3",
        title: "Official Seal & Releasing",
        description:
          "The document is sealed and released for submission to MSWDO for Solo Parent ID issuance.",
      },
    ],
    requirements: [
      {
        requirement: "None (Interview and verification conducted at Barangay Hall)",
        whereToSecure: "Barangay Hall",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Proceed to the Barangay Hall for interview and sign in the logbook",
        agencyAction:
          "1.1 Conduct the interview for solo parent affidavit (10 mins, Secretary); 1.2 Prepare the affidavit (5 mins, Secretary); 1.3 Sign the affidavit (5 mins, Punong Barangay)",
        fee: "None",
        processingTime: "20 minutes",
        personResponsible: "Barangay Secretary, Punong Barangay",
      },
      {
        stepNumber: 2,
        clientStep: "Receive the Affidavit",
        agencyAction: "Releasing of Affidavit",
        fee: "None",
        processingTime: "3 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the Customer Satisfaction Survey (CSS)",
        agencyAction:
          "Request client to accomplish the client satisfaction survey (CSS) and to be dropped in the Drop box for Feedback placed at the Barangay Hall",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "28 minutes",
  },

  // 12. Issuance of Certificate of Employment
  {
    id: "12-certificate-of-employment",
    number: "12",
    category: "Certification",
    categoryLabel: "Barangay Certification",
    title: "12. Issuance of Certificate of Employment",
    description:
      "This service issues the certificate of employment of all current and former Barangay employees seeking employment, reference, or proof of public service.",
    office: "Office of the Barangay",
    classification: "Simple",
    typeOfTransaction: "G2G / G2C – Government to Government / Citizen",
    whoMayAvail: "All Current and Former Barangay Employees",
    legalBasis: "Civil Service Commission (CSC) Rules & Local Government Code (RA 7160)",
    systemProcessFlow: [
      {
        step: "Step 1",
        title: "Service Records Verification",
        description:
          "Applicant submits request; Secretary checks barangay personnel records, term of service, and designation history.",
      },
      {
        step: "Step 2",
        title: "Certificate Drafting & Executive Endorsement",
        description:
          "Certificate of Employment is generated; Punong Barangay or Sangguniang Barangay Member Officer of the Day signs the certificate.",
      },
      {
        step: "Step 3",
        title: "Seal & Document Releasing",
        description:
          "Official Barangay seal is affixed and certificate is handed over to the employee.",
      },
    ],
    requirements: [
      {
        requirement: "Request Form (1 Original Copy)",
        whereToSecure: "Barangay Hall",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        clientStep: "Submit the request form",
        agencyAction:
          "1.1 Check, receive and record the request (3 mins, Secretary); 1.2 Prepare the Certificate of Employment (5 mins, Secretary); 1.3 Sign the certificate (5 mins, Punong Barangay or SB Member Officer of the Day)",
        fee: "None",
        processingTime: "13 minutes",
        personResponsible: "Barangay Secretary, Punong Barangay / SB Member Officer of the Day",
      },
      {
        stepNumber: 2,
        clientStep: "Receive the Certificate of Employment",
        agencyAction: "Release the Certificate of Employment",
        fee: "None",
        processingTime: "2 minutes",
        personResponsible: "Barangay Secretary",
      },
      {
        stepNumber: 3,
        clientStep: "Accomplish the CSS",
        agencyAction:
          "Request client to accomplish the client satisfaction survey (CSS) and to be dropped in the Drop box for Feedback placed at the Barangay Hall",
        fee: "None",
        processingTime: "5 minutes",
        personResponsible: "Barangay Secretary",
      },
    ],
    totalFee: "None (Free of Charge)",
    totalTime: "20 minutes",
  },
];
