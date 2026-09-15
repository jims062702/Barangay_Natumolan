import Card from "../../../../shared/ui/Card";
import ReplayOnView from "../../../../shared/ui/ReplayOnView";
import BandChart from "../../../../shared/ui/BandChart";
import type { PopulationDashboardState } from "../../hooks/usePopulationDashboard";

/**
 * Population by purok, and the dependency groups.
 */
export function PurokAndDependency({ ctx }: { ctx: PopulationDashboardState }) {
  const { purokData, dependencyData, analytics } = ctx;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card title="Population by purok" className="flex h-full flex-col">
        <p className="-mt-2 mb-3 text-xs text-gray-500">
          Residents in each purok, in purok order.
        </p>
        {purokData.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-16 text-sm text-gray-400">
            No puroks assigned yet.
          </p>
        ) : (
          <ReplayOnView className="flex min-h-0 flex-1 flex-col">
            <BandChart data={purokData} minHeight={240} unit="residents" />
          </ReplayOnView>
        )}
      </Card>

      <Card title="Dependency groups" className="flex h-full flex-col">
        {dependencyData.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No birthdates recorded yet.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <ReplayOnView className="flex min-h-0 flex-1 flex-col">
              <BandChart data={dependencyData} minHeight={180} unit="residents" />
            </ReplayOnView>
            <dl className="mt-3 shrink-0 divide-y divide-gray/70 text-sm">
              {[
                ["Youth dependency", analytics?.dependency.youth_dependency_ratio],
                ["Old-age dependency", analytics?.dependency.old_age_dependency_ratio],
                ["Total dependency", analytics?.dependency.total_dependency_ratio],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between py-2">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-semibold text-dark">{value ?? 0} per 100</dd>
                </div>
              ))}
            </dl>
            {(analytics?.dependency.unknown_age ?? 0) > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                {analytics?.dependency.unknown_age} resident(s) have no birthdate and are
                excluded from these ratios.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
