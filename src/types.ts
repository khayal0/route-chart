export interface HistoryPoint {
  snapshotId: number;
  timestampUtc: string;
  timestampUk: string;
  tenor: string;
  pointType: string;
  source: string;
  costCalculationType: string;
  open: number;
  close: number;
  min: number;
  max: number;
  avg: number;
}
export type RouteKey = "r1" | "r2";
export type RouteData = { costs: HistoryPoint[]; spreads: HistoryPoint[] };
export type CostBase = "cost_all" | "cost_fixed" | "cost_variable";
export type SpreadBase = "spread_acp" | "spread_trayport";
export type MetricBase = CostBase | SpreadBase;
export type MetricKeyForRoute<R extends RouteKey> = `${MetricBase}_${R}`;
export type CombinedRow = {
  timestampUk: string;
  tenor: string;

  cost_all_r1?: number;
  cost_fixed_r1?: number;
  cost_variable_r1?: number;
  spread_acp_r1?: number;
  spread_trayport_r1?: number;

  cost_all_r2?: number;
  cost_fixed_r2?: number;
  cost_variable_r2?: number;
  spread_acp_r2?: number;
  spread_trayport_r2?: number;
};
