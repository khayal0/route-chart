import type { MetricKey } from "./App";

export const METRICS: Array<{
  key: MetricKey;
  label: string;
  colorKey: MetricKey;
}> = [
  { key: "spread_acp", label: "Spread ACP", colorKey: "spread_acp" },
  {
    key: "spread_trayport",
    label: "Spread Trayport",
    colorKey: "spread_trayport",
  },
  { key: "cost_all", label: "Cost All", colorKey: "cost_all" },
  { key: "cost_fixed", label: "Cost Fixed", colorKey: "cost_fixed" },
  { key: "cost_variable", label: "Cost Variable", colorKey: "cost_variable" },
];

export const COLORS: Record<string, string> = {
  cost_all: "#4afe03",
  cost_fixed: "#0367fe",
  cost_variable: "#38fff8",
  spread_acp: "#ef4444",
  spread_trayport: "#facc15",
};
