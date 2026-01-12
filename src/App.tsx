import { costs as costsRaw } from "./data/cost.js"
import { spreads as spreadsRaw } from "./data/spread.js"
import { useMemo } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import customParseFormat from "dayjs/plugin/customParseFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import dayjs from "dayjs";
import "./App.css";

dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);

type CostRow = {
  snapshotId: number
  timestampUk: string
  tenor: string
  costCalculationType: "All" | "Fixed" | "Variable"
  avg: number
}

type SpreadRow = {
  snapshotId: number
  timestampUk: string
  tenor: string
  source: "acp" | "trayport" | string
  avg: number
}

type CombinedRow = {
  timestampUk: string
  tenor: string

  cost_all?: number
  cost_fixed?: number
  cost_variable?: number

  spread_acp?: number
  spread_trayport?: number
}

const COLORS = {
  cost_all: "#4afe03",
  cost_fixed: "#0367fe",
  cost_variable: "#38fff8",

  spread_acp: "#ef4444",
  spread_trayport: "#facc15",
}



function normalizeCostType(v: string) {
  const t = v.toLowerCase()
  if (t === "all") return "all"
  if (t === "fixed") return "fixed"
  if (t === "variable") return "variable"
  return "other"
}

function normalizeMarket(v: string) {
  const t = v.toLowerCase()
  if (t === "acp") return "acp"
  if (t === "trayport") return "trayport"
  return "other"
}

// Deduplicate ONLY on weekends (Sat/Sun) and ONLY when
// everything is identical EXCEPT timestampUk and unrelevant variables.
// Weekdays are kept intact.

function deduplicateWeekends(data) {
  const seen = new Set();
  const excluded = new Set(["timestampUk", "timestampUtc", "counter", "snapshotId"]);

  return data.filter((row) => {
    const timeStamp = dayjs(row.timestampUk, "YYYY-MM-DD HH:mm", true);
    if (!timeStamp.isValid()) return true;

    const dow = timeStamp.day();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend) return true;

    // Create weekId to group keys by distinct weeks
    const weekId = `${timeStamp.isoWeekYear()}-W${String(timeStamp.isoWeek()).padStart(2, "0")}`;

    const baseKey = Object.keys(row)
      .filter((k) => !excluded.has(k))
      .sort()
      .map((k) => {
        const v = row[k];
        return `${k}=${typeof v === "number" ? String(v) : String(v).trim()}`;
      })
      .join("|");

    const key = `${weekId}|${baseKey}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const costs = deduplicateWeekends(costsRaw);
const spreads = deduplicateWeekends(spreadsRaw);

function combineByTimestampUk(
  costs: CostRow[],
  spreads: SpreadRow[]
): CombinedRow[] {
  const map = new Map<string, CombinedRow>()

  const ensure = (timestampUk: string, tenor: string) => {
    if (!map.has(timestampUk)) {
      map.set(timestampUk, {
        timestampUk,
        tenor,
      })
    }
    return map.get(timestampUk)!
  }

  for (const c of costs) {
    const row = ensure(c.timestampUk, c.tenor)
    const t = normalizeCostType(c.costCalculationType)

    if (t === "all") row.cost_all = c.avg
    if (t === "fixed") row.cost_fixed = c.avg
    if (t === "variable") row.cost_variable = c.avg
  }

  for (const s of spreads) {
    const row = ensure(s.timestampUk, s.tenor)
    const m = normalizeMarket(s.source)

    if (m === "acp") row.spread_acp = s.avg
    if (m === "trayport") row.spread_trayport = s.avg
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.timestampUk).getTime() -
      new Date(b.timestampUk).getTime()
  )
}



export default function CostsAndSpreadsChart() {
  const data = useMemo(
    () => combineByTimestampUk(costs, spreads),
    []
  )

  return (
    <div style={{ width: "90%", height: 600 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid
            vertical={false}
            stroke="#ccc"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
          <XAxis dataKey="timestampUk" />
          <YAxis />
          <Tooltip />
          <Legend
            align="left"
            wrapperStyle={{ paddingLeft: "60px", paddingTop: "10px" }}
          />

          {/* Spreads */}
          <Line
            type="linear"
            dataKey="spread_acp"
            name="Spread ACP"
            stroke={COLORS.spread_acp}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="spread_trayport"
            name="Spread Trayport"
            stroke={COLORS.spread_trayport}
            strokeWidth={2}
            dot={false}
            connectNulls
          />

          {/* Costs */}
          <Line
            type="linear"
            dataKey="cost_all"
            name="Cost All"
            stroke={COLORS.cost_all}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="cost_fixed"
            name="Cost Fixed"
            stroke={COLORS.cost_fixed}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="cost_variable"
            name="Cost Variable"
            stroke={COLORS.cost_variable}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
