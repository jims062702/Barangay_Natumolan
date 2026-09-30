import { useEffect, useState } from "react";
import { FiAward, FiBell, FiExternalLink, FiImage } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { PageLoading, settleAll, usePageLoad } from "../../../shared/ui/PageLoad";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { contentApi } from "../../content/api";
import { councilApi } from "../../council/api";

export default function SkDashboard() {
  const [heroCount, setHeroCount] = useState(0);
  const [officialCount, setOfficialCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);

  // Live updates: bump `tick` to re-run the fetches below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("announcements", () => setTick((t) => t + 1));

  /* Its skeleton until the first answer, then the page — see PageLoad. A
     refresh after that keeps the page; only a first load that gets NO
     answer at all shows the error. */
  const pageLoad = usePageLoad();

  useEffect(() => {
    void Promise.allSettled([
      contentApi.heroSlides().then((r) => setHeroCount((r.data.data ?? []).length)),
      councilApi.officials().then((r) => setOfficialCount((r.data.data ?? []).length)),
      contentApi.posts().then((r) => setNewsCount(r.data.data.total ?? 0)),
    ]).then((results) => settleAll(pageLoad, results));
  }, [tick]);

  if (pageLoad.state !== "ready") return <PageLoading load={pageLoad} onRetry={() => setTick((t) => t + 1)} />;

  return (
    <div>
      <PageHeader
        title="Sangguniang Kabataan"
        subtitle="The barangay youth organization — publishes news & announcements and curates the public landing page (home pictures, news, officials)"
        actions={
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            <FiExternalLink aria-hidden="true" /> View public site
          </a>
        }
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Home Pictures" value={heroCount} icon={FiImage} />
        <StatTile label="News & Announcements" value={newsCount} icon={FiBell} tone="warning" />
        <StatTile label="Officials Listed" value={officialCount} icon={FiAward} tone="success" />
      </RevealGroup>

      <Card title="Manage landing content" className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: "/sk/hero-slides", label: "Home Pictures", icon: FiImage, hint: "Hero carousel photos" },
            { to: "/sk/announcements", label: "News & Announcements", icon: FiBell, hint: "Posts shown to residents" },
            { to: "/sk/officials", label: "Officials", icon: FiAward, hint: "Barangay & SK officials" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col gap-1 rounded-2xl border border-gray p-5 transition-colors hover:border-primary"
            >
              <item.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <span className="mt-1 font-semibold text-dark">{item.label}</span>
              <span className="text-xs text-gray-500">{item.hint}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
