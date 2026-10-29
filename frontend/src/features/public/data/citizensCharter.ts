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
  category: "Clearance" | "Certification" | "Lupon" | "VAWC" | "Resolution";
  categoryLabel: string;
  title: string;
  description: string;
  office: string;
  classification: "Simple" | "Complex" | "Highly Technical";
  typeOfTransaction: "G2C – Government to Citizen" | "G2C – Government to Client" | "G2B – Government to Business";
  whoMayAvail: string;
  legalBasis: string;
  systemProcessFlow: SystemProcessStep[];
  requirements: CharterRequirement[];
  feesSchedule?: FeeItem[];
  steps: CharterStep[];
  totalFee: string;
  totalTime: string;
  portalLink?: string;
  portalActionLabel?: string;
}

export const CITIZENS_CHARTER_CATEGORIES = [
  { key: "", label: "All" },
  { key: "Clearance", label: "Barangay Clearance" },
  { key: "Certification", label: "Barangay Certification" },
  { key: "Lupon", label: "Katarungang Pambarangay (Lupon)" },
  { key: "VAWC", label: "Barangay Protection Order (VAWC)" },
  { key: "Resolution", label: "Barangay Resolution" },
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
    whoMayAvail: "ALL (Residents and parties with disputes within Barangay Natumolan jurisdiction)",
    legalBasis: "Service is covered under Republic Act No. 7160 (Local Government Code of 1991).",
    portalLink: "/portal/complaints",
    portalActionLabel: "Mag-file ng Reklamo sa Lupon Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "Online Complaint Filing / Counter Intake",
        description:
          "Maaaring mag-file ang nagrereklamo sa pamamagitan ng Resident Portal (File Complaint) 24/7 mula sa bahay, o mag-walk-in sa Barangay Hall kung saan i-e-encode ng Lupon Clerk ang complaint form.",
      },
      {
        step: "2",
        title: "Automated Docketing & Fee Recording",
        description:
          "Awtomatikong binibigyan ng system ng natatanging KP Case Reference Number (hal. 2026-XX-XX-XX) ang reklamo at ini-isyu ang Official Receipt para sa filing fee (₱20.00).",
      },
      {
        step: "3",
        title: "Digital Summons & Hearing Scheduling",
        description:
          "Inilalabas ng kalihim ang pormal na patawag (Summons). Nakatala sa system calendar ang schedule ng Mediation hearing at may abiso sa portal at SMS.",
      },
      {
        step: "4",
        title: "Mediation Session & Settlement Recording",
        description:
          "Isasagawa ang pagdinig kasama ang Punong Barangay. Kapag nagkasundo, ang Kasunduan (Amicable Settlement) ay ini-encode at pinipirmahan sa logbook.",
      },
      {
        step: "5",
        title: "Digital Customer Satisfaction Survey (CSS)",
        description:
          "Matapos ang proseso, direktang masasagot ng residente ang Customer Satisfaction Survey sa kanilang portal account o sa physical drop box sa barangay hall.",
      },
    ],
    requirements: [
      {
        requirement: "Complaint's Form (1 original copy)",
        whereToSecure: "Barangay Hall / Resident Portal (Automated digital complaint form)",
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
    portalLink: "/portal/complaints",
    portalActionLabel: "Subaybayan ang Lupon Case Status Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "Requirement Submission & Verification",
        description:
          "Isusumite ang complaint kasama ang blotter o kaugnay na dokumento. Naka-record ang bawat transaksyon sa Lupon Docket ng Barangay Management System.",
      },
      {
        step: "2",
        title: "Mediation at Punong Barangay Level",
        description:
          "Isasagawa ang pagdinig sa loob ng 5 araw. Kung walang kasunduan, itatalaga ang Pangkat ng Tagapagsundo sa loob ng 3 araw.",
      },
      {
        step: "3",
        title: "Conciliation by Pangkat ng Tagapagsundo",
        description:
          "Pormal na conciliation session (45 minuto). Kung hindi pa rin magkasundo, pormal na itatala ang kabiguan ng pagkakasundo sa system.",
      },
      {
        step: "4",
        title: "Issuance of Certificate to File Action (CFA)",
        description:
          "Awtomatikong bubuuin ng system ang opisyal na Certificate to File Action (KP Form 20) na may QR validation at opisyal na lagda ng Pangkat Secretary at Punong Barangay.",
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
    portalLink: "/portal/requests/new",
    portalActionLabel: "Mag-request ng Kasunduan Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "Intake & Ownership Document Validation",
        description:
          "Haharap ang magkabilang panig sa tanggapan ng barangay o magpapasa online ng kanilang patunay ng pagmamay-ari (Ownership Document).",
      },
      {
        step: "2",
        title: "System Preparation of Agreement Certificate",
        description:
          "Ine-encode ng Kalihim ang buong detalye ng kasunduan sa system upang magkaroon ng digital archive at 3 opisyal na kopya.",
      },
      {
        step: "3",
        title: "Signing & Mutual Release",
        description:
          "Pipirmahan ng magkabilang panig ang 3 kopya ng kasulatan sa harap ng opisyal at agarang ipapamahagi.",
      },
      {
        step: "4",
        title: "Online / Drop Box Customer Satisfaction Survey",
        description:
          "Pagsasagawa ng CSS upang masiguro ang maayos at patas na paglilingkod ng barangay.",
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
    totalFee: "None (Free)",
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
    portalLink: "/portal/requests/new",
    portalActionLabel: "Mag-request ng Certification Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "Online Filing via Resident Portal or Counter",
        description:
          "Pipiliin ng residente ang partikular na Certificate type (hal. Residency, Indigency, Late Birth, Titling) at ilalagay ang layunin. Instant ang pagpapadala nang hindi kailangang pumila nang matagal.",
      },
      {
        step: "2",
        title: "Automated Population Registry Verification",
        description:
          "Kusang sinusuri ng system kung ang humihiling ay rehistradong residente sa RBIM Census Masterlist ng Barangay Natumolan at kung tama ang kanyang Purok/Zone.",
      },
      {
        step: "3",
        title: "Digital Processing & Barangay Seal",
        description:
          "Ini-imprenta at inilalagay ang opisyal na selyo at serye ng sertipikasyon, at pinipirmahan ng Punong Barangay o Officer of the Day.",
      },
      {
        step: "4",
        title: "Real-time Ready to Claim Notification & Pickup",
        description:
          "Makatatanggap ang residente ng abiso sa email/SMS at portal kapag 'Ready to Claim' na. Pupunta lamang sa Barangay Hall para magbayad (kung may bayad) at kunin ang dokumento.",
      },
      {
        step: "5",
        title: "Instant Digital Feedback (CSS)",
        description:
          "Matapos matanggap ang sertipikasyon, magbibigay ng ratings at komento sa pamamagitan ng portal CSS o physical drop box.",
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
      { item: "Certification of Common-Law", fee: "LIBRE / NONE" },
      { item: "Certification of Oneness", fee: "LIBRE / NONE" },
      { item: "Certification of Attestation", fee: "LIBRE / NONE" },
      { item: "Certification of Oath of Undertaking", fee: "LIBRE / NONE" },
      { item: "Certification of Indigency", fee: "LIBRE / NONE" },
      { item: "Certification for First Time Job Seeker (RA 11261)", fee: "LIBRE / NONE" },
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
        fee: "Ayon sa layunin (₱0 – ₱530.00)",
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
    totalFee: "Depende sa layunin (Libre hanggang ₱530.00)",
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
    legalBasis: "Service is covered under Republic Act No. 7160 (Local Government Code).",
    portalLink: "/portal/requests/new",
    portalActionLabel: "Mag-request ng Barangay Clearance Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "24/7 Online Application via Portal",
        description:
          "Pumili ng layunin (Employment, ID, Loan, License, Abroad, atbp.) sa Resident Portal o lumapit sa counter. May instant transaction reference code na ibinibigay ang system.",
      },
      {
        step: "2",
        title: "Digital Registry & Records Cross-Check",
        description:
          "Kusang sinusuri ng system ang rekord ng residente at tinitiyak na walang nakabinbing pananagutan sa Lupon o VAWC desk.",
      },
      {
        step: "3",
        title: "Document Generation & Official Seal",
        description:
          "Inilalabas ng Clerk ang opisyal na format ng Barangay Clearance kalakip ang QR verification code at opisyal na selyo bago pirmahan ng Punong Barangay o Officer of the Day.",
      },
      {
        step: "4",
        title: "SMS & Portal Notification / Fast Counter Pickup",
        description:
          "Agad na makatatanggap ang residente ng SMS/Portal alert kapag handa na. Pagdating sa Barangay Hall, ipe-presenta lamang ang reference code, magbabayad ng naaayong halaga na may Official Receipt, at kukunin ang clearance nang walang abala.",
      },
      {
        step: "5",
        title: "Customer Satisfaction Survey (CSS)",
        description:
          "Madaling maisusumite ang grado at feedback sa pamamagitan ng portal o sa feedback drop box.",
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
    totalFee: "₱60.00 hanggang ₱130.00",
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
    portalLink: "/portal/vawc-report",
    portalActionLabel: "Magsumite ng Kumpidensyal na VAWC Report Online",
    systemProcessFlow: [
      {
        step: "1",
        title: "Confidential Online Report or Direct Walk-in",
        description:
          "Maaaring magsumite ng ligtas at kumpidensyal na ulat sa Resident Portal (VAWC Incident Report) o direktang lumapit nang pribado sa VAWC Desk Officer sa Barangay Hall.",
      },
      {
        step: "2",
        title: "Urgent Assessment & Digital Intake",
        description:
          "Agad na ini-interview ng sinanay na VAWC Desk Officer ang biktima upang magawa ang opisyal na Intake Form nang may buong pag-iingat sa kanyang proteksyon at privacy.",
      },
      {
        step: "3",
        title: "Preparation & Signing of Barangay Protection Order (BPO)",
        description:
          "Inihahanda ang BPO sa loob ng 10 minuto at agarang pinipirmahan ng Punong Barangay o Officer of the Day (5 minuto).",
      },
      {
        step: "4",
        title: "Serving the Order to Respondent",
        description:
          "Inihahatid at pormal na isisilbi ng VAWC Desk Officer kasama ang Barangay Tanod ang Barangay Protection Order sa inirereklamong respondent sa loob ng 1 oras.",
      },
      {
        step: "5",
        title: "Confidential Follow-up & Feedback",
        description:
          "Pagsubaybay sa kaligtasan ng biktima at pagsagot sa Customer Satisfaction Survey sa ligtas na paraan.",
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
        fee: "None (Libre alinsunod sa RA 9262)",
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
    totalFee: "None (Walang Bayad)",
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
    portalLink: "/#contact",
    portalActionLabel: "Makipag-ugnayan sa Sangguniang Barangay",
    systemProcessFlow: [
      {
        step: "1",
        title: "Formal Letter of Intent & Document Submission",
        description:
          "Isusumite ng proponent ang kumpletong environmental compliance certificates, development plan, at clearances sa tanggapan ng Sangguniang Barangay.",
      },
      {
        step: "2",
        title: "First Reading in Regular Legislative Session",
        description:
          "Itatakda ng Kalihim ang panukalang resolusyon sa agenda ng regular session para sa Unang Pagbasa (First Reading).",
      },
      {
        step: "3",
        title: "Ocular Inspection & Joint Committee Review",
        description:
          "Pagsasagawa ng ocular inspection kasama ang MENRO, PENRO, at Solid Waste Management committee upang suriin ang kaligtasan sa kapaligiran.",
      },
      {
        step: "4",
        title: "Second & Third Reading / Final Council Enactment",
        description:
          "Pormal na deliberasyon, pagboto, at pagpapatibay ng Sangguniang Barangay sa Resolution of No Objection.",
      },
      {
        step: "5",
        title: "Official Digital Release & Archive",
        description:
          "Paglalabas ng certified true copy ng naaprubahang resolusyon na may legislative docket series number.",
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
    totalFee: "None (Walang Bayad)",
    totalTime: "37 days and 15 minutes",
  },
];

