import Card from "../../../../shared/ui/Card";
import { Coded } from "../fields/Coded";
import { Text } from "../fields/Text";
import { isOther } from "../../lib/rules";
import { DeathList } from "../fields/DeathList";
import { StringList } from "../fields/StringList";
import type { CensusFormState } from "../../hooks/useCensusForm";
import type { Codes, DeathRow } from "../../types";

/**
 * Part H — the questions asked of the household as a whole (Q45–Q58).
 */
export function HouseholdQuestions({ ctx, h, m }: { ctx: CensusFormState; h: Codes; m: Codes }) {
  const { form, set, listOf, setList } = ctx;

  return (
    <Card title="H. Questions for the household">
      <fieldset>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Coded label="Q45 Housing unit" list={h.tenures} value={form.q45_housing_tenure as number} onChange={(v) => set("q45_housing_tenure", v)} />
          <Coded label="Q46 Lot" list={h.tenures} value={form.q46_lot_tenure as number} onChange={(v) => set("q46_lot_tenure", v)} />
          <Coded label="Q47 Fuel for lighting" list={h.lighting_fuels} value={form.q47_lighting_fuel as number} onChange={(v) => set("q47_lighting_fuel", v)} />
          <Text
            label="Q47 If others, specify"
            maxLength={80}
            value={form.q47_other as string}
            onChange={(v) => set("q47_other", v)}
            disabled={!isOther(form.q47_lighting_fuel, h.lighting_fuels)}
            disabledNote="Only when the fuel is not on the list."
          />
          <Coded label="Q48 Fuel for cooking" list={h.cooking_fuels} value={form.q48_cooking_fuel as number} onChange={(v) => set("q48_cooking_fuel", v)} />
          <Text
            label="Q48 If others, specify"
            maxLength={80}
            value={form.q48_other as string}
            onChange={(v) => set("q48_other", v)}
            disabled={!isOther(form.q48_cooking_fuel, h.cooking_fuels)}
            disabledNote="Only when the fuel is not on the list."
          />
          <Coded label="Q49 Drinking water" list={h.water_sources} value={form.q49_water_source as number} onChange={(v) => set("q49_water_source", v)} />
          <Text
            label="Q49 If others, specify"
            maxLength={80}
            value={form.q49_other as string}
            onChange={(v) => set("q49_other", v)}
            disabled={!isOther(form.q49_water_source, h.water_sources)}
            disabledNote="Only when the source is not on the list."
          />
          <Coded label="Q50a Kitchen garbage" list={h.garbage_disposal} value={form.q50a_garbage_disposal as number} onChange={(v) => set("q50a_garbage_disposal", v)} />
          <Coded label="Q50b Segregates garbage" list={h.yes_no} value={form.q50b_segregates as number} onChange={(v) => set("q50b_segregates", v)} />
          <Coded label="Q51 Toilet facility" list={h.toilets} value={form.q51_toilet as number} onChange={(v) => set("q51_toilet", v)} />
          <Text
            label="Q51 If others, specify"
            maxLength={80}
            value={form.q51_other as string}
            onChange={(v) => set("q51_other", v)}
            disabled={!isOther(form.q51_toilet, h.toilets)}
            disabledNote="Only when the facility is not on the list."
          />
          <Coded label="Q52 Type of building" hint="Observed, not asked." list={h.building_types} value={form.q52_building_type as number} onChange={(v) => set("q52_building_type", v)} />
          <Coded label="Q53 Outer wall material" hint="Observed, not asked." list={h.outer_walls} value={form.q53_outer_wall as number} onChange={(v) => set("q53_outer_wall", v)} />
          <Text
            label="Q53 If others, specify"
            maxLength={80}
            value={form.q53_other as string}
            onChange={(v) => set("q53_other", v)}
            disabled={!isOther(form.q53_outer_wall, h.outer_walls)}
            disabledNote="Only when the material is not on the list."
          />

          {/*
            Four questions the paper gives a fixed number of blanks and
            life does not. A household can lose two people in a year and
            can name four diseases; recorded in three boxes, the fourth
            answer simply never happened.
          */}
          <DeathList
            label="Q54 Female deaths in the past 12 months"
            hint="Every woman in this household who died in the past year, whatever the cause."
            rows={listOf<DeathRow>("q54_female_deaths")}
            onChange={(next) => setList("q54_female_deaths", next)}
            addLabel="Add a death"
            maxAge={120}
          />
          <DeathList
            label="Q55 Deaths of children under five, past 12 months"
            rows={listOf<DeathRow>("q55_child_deaths")}
            onChange={(next) => setList("q55_child_deaths", next)}
            addLabel="Add a death"
            maxAge={5}
            sexes={m.sexes}
          />
          <StringList
            label="Q56 Most common diseases in the household"
            placeholder="e.g. Hypertension"
            values={listOf<string>("q56_common_diseases")}
            onChange={(next) => setList("q56_common_diseases", next)}
            addLabel="Add a disease"
          />
          <StringList
            label="Q57 Primary needs of the household"
            placeholder="e.g. Livelihood assistance"
            values={listOf<string>("q57_primary_needs")}
            onChange={(next) => setList("q57_primary_needs", next)}
            addLabel="Add a need"
          />

          <Text label="Q58 In 5 years — barangay" maxLength={80} value={form.q58_intend_barangay as string} onChange={(v) => set("q58_intend_barangay", v)} />
          <Text label="Q58 Municipality" maxLength={80} value={form.q58_intend_municipality as string} onChange={(v) => set("q58_intend_municipality", v)} />
          <Text label="Q58 Province" maxLength={80} value={form.q58_intend_province as string} onChange={(v) => set("q58_intend_province", v)} />
        </div>
      </fieldset>
    </Card>
  );
}
