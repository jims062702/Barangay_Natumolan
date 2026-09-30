/**
 * "How do I file a complaint?" — answered by the widget itself.
 *
 * Rasa's `ask_lupon` reply says to file "at the Lupon desk in the Barangay
 * Hall", which was the only way until the online form existed. Retraining
 * the model is not something this page can do, and when Rasa is down the
 * fallback search has no complaint guide at all. So a question about filing
 * is recognised HERE and answered the same way whichever of the two is up —
 * with the way to do it online, the way to do it in person, and a button.
 *
 * THE VAWC CHECK COMES FIRST. "Gusto ko mag-reklamo, sinaktan ako ng asawa
 * ko" is a request to file a complaint, and the one answer it must never get
 * is a link to the Katarungang Pambarangay form: KP mediation is prohibited
 * for violence against women and children, because it puts her in a room
 * with the man who hurt her. It is sent to the VAWC Desk instead, and the
 * form's own screen would refuse it anyway — this simply does not send her
 * there to be refused.
 */

import { mentionsVawc } from "../../lupon/lib/jurisdictionScreen";

/*
 * Words people use for it, in English, Tagalog and Bisaya. Whole words only.
 *
 * NOT "kaso" on its own: in Tagalog it is also "but" ("kaso wala akong
 * ID"), and a resident saying that is not asking to sue anybody. "Magsampa
 * ng kaso" and "file ng kaso" are unambiguous and are here.
 */
const WORDS = [
  "complaints?", "complain", "file a case", "file ng kaso", "magsampa",
  "reklamo", "ireklamo", "mag-reklamo", "nireklamo",
  "sumbong", "isumbong", "mag-sumbong",
  "kiha", "mag-kiha", "ikiha",
  "blotter", "dispute",
];

/* "mag-reklamo" also matches "magreklamo" and "mag reklamo". */
const ASKING = new RegExp(`\\b(?:${WORDS.map((w) => w.replace(/-/g, "[- ]?")).join("|")})\\b`, "i");

export function asksAboutComplaint(text: string): boolean {
  return ASKING.test(text);
}

export function complaintAnswer(text: string, isResident: boolean): { text: string; buttons: { title: string; payload: string }[] } {
  if (mentionsVawc(text)) {
    return {
      text:
        "This sounds like it may involve violence against a woman or a child. The Lupon cannot "
        + "mediate these — the law forbids it, because mediation would put you in the same room "
        + "as the person who hurt you.\n\n"
        + "Please go to the Barangay VAWC Desk at the Barangay Hall (Mon–Fri, 8:00 AM–5:00 PM). "
        + "What you tell them is confidential. If you are in danger now, call 911.\n\n"
        + "A woman who is a registered resident can also send a VAWC Online Complaint to the VAW Desk, with her "
        + "Barangay Resident ID — it goes to the desk only.",
      buttons: [
        { title: "VAWC Online Complaint", payload: "__vawc__" },
        { title: "Talk to Clerk", payload: "__live__" },
      ],
    };
  }

  return {
    text:
      "You can file a Katarungang Pambarangay complaint in two ways:\n"
      + "• Online — "
      + (isResident
        ? "your name and address are taken from your barangay record, so you only describe what happened and attach a photo of your ID."
        : "fill in the form and attach a photo of a valid ID. You may file even if you live elsewhere, as long as the person you are complaining about lives in Barangay Natumolan.")
      + "\n• In person — at the Lupon desk in the Barangay Hall, Mon–Fri, 8:00 AM–5:00 PM.\n\n"
      + "Filing online gives you a reference number, not a case number. Bring the same ID to "
      + "the Barangay Office: the complaint is verified there, and the Lupon accepts it into "
      + "the process.",
    buttons: [
      { title: "File a complaint online", payload: "__complaint__" },
      { title: "Talk to Clerk", payload: "__live__" },
    ],
  };
}

/** Where the form is, for whoever is asking. */
export function complaintFormPath(isResident: boolean): string {
  return isResident ? "/resident/file-complaint" : "/file-complaint";
}
