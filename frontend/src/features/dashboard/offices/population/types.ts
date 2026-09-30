/**
 * The population analytics the dashboard is sent.
 */

export interface MonthPoint {
  month: string;
  label: string;
  added: number;
  on_the_register: number;
}

export interface Headcount {
  total: number;
  male: number;
  female: number;
  /** In the population, in neither sex column: the register has no sex for them. */
  sex_not_recorded: number;
  /** 18 and over. */
  adults: number;
  /** 17 and under. */
  minors: number;
  /** In the population, in neither age column: no birthdate on the register. */
  age_not_recorded: number;
  as_of: string;
}

export interface Analytics {
  total_population: number;
  total_households: number;
  average_household_size: number;
  portal_accounts: number;
  population_by_age_group: Record<string, number>;
  population_by_gender: Record<string, number>;
  /** The four figures every barangay report asks for — see Analytics::headcount. */
  headcount?: Headcount;
  population_by_zone: { zone_purok: string; count: number }[];
  events_this_year: { event_type: string; count: number }[];
  register_by_month: MonthPoint[];
  dependency: {
    young_dependents: number;
    working_age: number;
    old_dependents: number;
    unknown_age: number;
    youth_dependency_ratio: number;
    old_age_dependency_ratio: number;
    total_dependency_ratio: number;
  };
  migration: {
    year: number;
    in_migration: number;
    out_migration: number;
    net_migration: number;
  };
  growth: {
    year: number;
    births: number;
    deaths: number;
    natural_increase: number;
    net_change: number;
    growth_rate: number;
    newly_registered: number;
  };
  sector_counts: { sector_type: string; count: number }[];
  intervention: {
    households_flagged: number;
    by_indicator: Record<string, number>;
    indicators: string[];
  };
}
