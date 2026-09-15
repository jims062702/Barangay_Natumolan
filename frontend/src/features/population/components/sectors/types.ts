/**
 * The sector report, as the server sends it and the charts read it.
 */

export interface SectorRow {
  sector_type: string;
  count: number;
}

export interface CoveragePoint {
  month: string;
  label: string;
  joined: number;
  on_a_list: number;
}

export interface Report {
  sectors: SectorRow[];
  population: number;
  people_on_a_list: number;
  people_on_no_list: number;
  tags: number;
  coverage: CoveragePoint[];
}

export interface SectorPoint extends SectorRow {
  short: string;
  share: number;
}
