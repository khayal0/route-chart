import { costs } from "./data/cost.js"
import { spreads } from "./data/spread.js"
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
  cost_all: "#1d4ed8",
  cost_fixed: "#06b6d4",
  cost_variable: "#15fab1ff",

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
    <div style={{ width: "100%", height: 400 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestampUk" />
          <YAxis />
          <Tooltip />
          <Legend />

          {/* Spreads */}
          <Line
            type="linear"
            dataKey="spread_acp"
            name="Spread ACP"
            stroke={COLORS.spread_acp}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="spread_trayport"
            name="Spread Trayport"
            stroke={COLORS.spread_trayport}
            dot={false}
            connectNulls
          />

          {/* Costs */}
          <Line
            type="linear"
            dataKey="cost_all"
            name="Cost All"
            stroke={COLORS.cost_all}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="cost_fixed"
            name="Cost Fixed"
            stroke={COLORS.cost_fixed}
            dot={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="cost_variable"
            name="Cost Variable"
            stroke={COLORS.cost_variable}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
