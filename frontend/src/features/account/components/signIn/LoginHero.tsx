import { FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";
import sideImage from "../../../../assets/images/barangay-officials.jpg";
import logo from "../../../../assets/logo/logo.svg";

/**
 * The barangay's side of the sign-in page.
 */
export function LoginHero() {
  return (
    <div className="relative hidden w-1/2 overflow-hidden lg:block">
      {/*
        Two copies of the one photo, and only one of them is meant to be
        looked at.

        The panel is half a wide screen — nearly square — and the photo is
        landscape, so `object-cover` filled the box by cutting 14 to 20 per
        cent off each SIDE. What it cut was the councillors standing at
        either end: the barangay's own officials, absent from the barangay's
        own sign-in page.

        So the sharp copy is CONTAINED, whole, everybody in it. A blurred,
        over-scaled copy fills the space that leaves, which under a
        seventy-per-cent colour wash reads as texture rather than as a
        letterbox. The file is fetched once and drawn twice.
      */}
      <img
        src={sideImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
      />
      <img
        src={sideImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/*
        Two layers, because they do two jobs.

        The brand wash is the look — the same purple-into-magenta the landing
        page puts over this photo. The scrim underneath the text is legibility:
        the wash alone thins out towards the bottom right, and the heading sits
        over faces and a bright pink shirt rather than over flat colour.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-primary-dark/90 via-primary/80 to-fuchsia-600/70"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-primary-dark/70 via-primary-dark/20 to-transparent"
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
        >
          <FiArrowLeft aria-hidden="true" /> Back to website
        </Link>

        <div>
          <img src={logo} alt="" aria-hidden="true" className="h-20 w-20" />
          <h1 className="mt-6 max-w-md text-4xl font-extrabold leading-tight text-white">
            Barangay Natumolan
          </h1>
          <p className="mt-3 max-w-md text-lg font-light text-white/90">
            Management Information System
          </p>
          {/* white/90, not /75: measured at 4.3:1 over the photo, which is under
              AA. The flat illustration this replaced was darker here. */}
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/90">
            One system for certificates, requests, appointments, and barangay
            services — serving every Natumolanon with transparency, unity,
            and excellence.
          </p>
        </div>

        <p className="text-xs text-white/80">
          Tagoloan · Misamis Oriental · Philippines
        </p>
      </div>
    </div>
  );
}
