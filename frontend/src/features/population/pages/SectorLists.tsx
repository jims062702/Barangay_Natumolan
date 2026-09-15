import PageHeader from "../../../shared/ui/PageHeader";
import { useSectorReport } from "../hooks/useSectorReport";
import { SectorTotals } from "../components/sectors/SectorTotals";
import { SectorGrowthChart } from "../components/sectors/SectorGrowthChart";
import { SectorSizeChart } from "../components/sectors/SectorSizeChart";
import { SectorBrowser } from "../components/sectors/SectorBrowser";

export default function SectorLists() {
  const ctx = useSectorReport();

  return (
    <div>
      <PageHeader
        title="Sectoral Profiling & Master Lists"
        subtitle="Validated lists for priority sectors — children, seniors, PWD, solo parents, and more"
      />

      {/*
        Three numbers, and the reason there are three.

        The page led with 57 — the number of TAGS — which reads as a headcount
        and is not one: one person carries several, and one carried nine.
      */}
      <SectorTotals ctx={ctx} />

      {/*
        The one thing on this page that is a TREND, and so the only thing a
        line belongs on: how much of the barangay is on a list, month by
        month.

        The chart below it plots the same thirteen sectors as columns with a
        line across their tops. That line is a rank curve — the shape of the
        drop-off from the big lists into the long tail — and not a movement
        through time, which is what this one is.

        Brand purple on the app's own surface, validated rather than picked:
        #723ec3 on white clears the lightness band, the chroma floor and 3:1
        contrast.
      */}
      <SectorGrowthChart ctx={ctx} />

      {/*
        Every sector, as a real chart — the same one the panel above uses.

        Columns carry the magnitude, and the line traces their tops. Sorted
        largest first, that line is the SHAPE of the barangay's lists: a
        steep drop from the few big ones into a long tail of small ones, which
        is the thing an officer plans around and which thirteen separate bars
        never quite say out loud.

        Same hue, same grid, same hover as the coverage chart, so the two read
        as one page rather than as two.
      */}
      <SectorSizeChart ctx={ctx} />

      {/*
        The list itself, as a table that can be searched and filtered.

        It was a name and a purok. A Population Officer building a feeding
        list needs the age, and needs to know which of these children are also
        4Ps — and going to each profile one at a time to find out is how a
        list of forty takes an afternoon.
      */}
      <SectorBrowser ctx={ctx} />
    </div>
  );
}

