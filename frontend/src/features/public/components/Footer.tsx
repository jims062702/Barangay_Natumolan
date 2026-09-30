import type { IconType } from "react-icons";
import { FaFacebookF, FaFacebookMessenger, FaEnvelope } from "react-icons/fa";
import { navLinks } from "../data/navLinks";
import logo from "../../../assets/logo/barangay-logo.png";
import banner from "../../../assets/logo/officials-banner.jpg";

interface SocialLink {
  label: string;
  href: string;
  icon: IconType;
}

const socials: SocialLink[] = [
  { label: "Facebook", href: "https://www.facebook.com", icon: FaFacebookF },
  { label: "Messenger", href: "https://www.messenger.com", icon: FaFacebookMessenger },
  { label: "Email", href: "mailto:barangaynatumolan@gmail.com", icon: FaEnvelope },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-primary-dark text-white">
      {/*
        The barangay's own officials behind the footer — the same picture
        the staff sidebar carries, so the public page and the office end on
        the same faces.

        A WIDE BAND, CUT TO KEEP EVERY FACE. The footer is a 3:1 strip and
        the photograph is 3:2, so a centred cover crop drove a window
        straight through the back row's heads: eleven officials with six of
        them beheaded is not a portrait of a council. `officials-banner` is
        cropped once, to the band the faces live in, and rendered at the
        width the footer actually is — the 640px file was being blown up
        more than twice and came out soft.

        The wash stays: a white polo shirt sits directly beneath white
        footer text, and without it the text disappears into the shirt.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
        /* Held ABOVE centre. The footer is shorter than the band, so a
           centred crop still took the top off the standing row's heads;
           30% leaves them headroom and keeps the seated row's chins in. */
        style={{ backgroundImage: `url(${banner})`, backgroundPosition: "center 30%" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/75 via-primary-dark/70 to-primary-dark/85"
      />

      {/* A LITTLE TALLER THAN IT NEEDS TO BE, on purpose. The footer is a
          wider strip than the photograph's face band, so a shorter one
          crops the standing row's heads no matter where it is positioned.
          The extra padding is what makes eleven whole faces fit. */}
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-3 lg:px-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3">
            <img src={logo} alt="Barangay Natumolan logo" className="h-14 w-14" />
            <div>
              <p className="text-lg font-bold">Barangay Natumolan</p>
              <p className="text-sm text-white/75">Tagoloan, Misamis Oriental</p>
            </div>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/80">
            Serving the community with transparency, unity, and excellence —
            your barangay government working for every Natumolanon.
          </p>
        </div>

        {/* Quick links */}
        <nav aria-label="Footer quick links" className="md:justify-self-center">
          <h3 className="text-base font-semibold">Quick Links</h3>
          {/*
            TWO COLUMNS, NOT SEVEN ROWS. A single stack of seven links ran
            far below the two blocks beside it and left the footer lopsided
            — a column of text on the left, a column of text on the right,
            and a ladder down the middle. Paired up, the three blocks end
            within a line of each other.
          */}
          <ul className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2.5">
            {navLinks.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="text-sm text-white/80 transition-colors hover:text-white hover:underline"
                >
                  {link.short}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Socials */}
        <div className="md:justify-self-end">
          <h3 className="text-base font-semibold">Connect With Us</h3>
          <div className="mt-4 flex gap-3">
            {socials.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:text-primary"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/75">
            Follow our official pages for the latest barangay updates and
            announcements.
          </p>
        </div>
      </div>

      <div className="relative border-t border-white/15">
        {/* Extra side room: the assistant button floats over the bottom-right
            corner and this line is the last thing it would cover. Padded on
            both sides so the text stays centred. */}
        <p className="mx-auto max-w-7xl px-20 py-5 text-center text-sm text-white/80 sm:px-24 lg:px-8">
          © {year} Barangay Natumolan. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
