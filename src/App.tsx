import { useMemo, useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from "recharts"
import type { DataKey } from "recharts/types/util/types"
import customParseFormat from "dayjs/plugin/customParseFormat"
import isoWeek from "dayjs/plugin/isoWeek"
import dayjs from "dayjs"

import { costs as costsRawR1 } from "./data/cost.js"
import { spreads as spreadsRawR1 } from "./data/spread.js"
import { costs as costsRawR2 } from "./data/cost2.js"
import { spreads as spreadsRawR2 } from "./data/spread.js"

import "./App.css"
import CustomLegend from "./CustomLegend.tsx"

dayjs.extend(customParseFormat)
dayjs.extend(isoWeek)

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

type RouteKey = "r1" | "r2"

type CombinedRow = {
  timestampUk: string
  tenor: string

  cost_all_r1?: number
  cost_fixed_r1?: number
  cost_variable_r1?: number
  spread_acp_r1?: number
  spread_trayport_r1?: number

  cost_all_r2?: number
  cost_fixed_r2?: number
  cost_variable_r2?: number
  spread_acp_r2?: number
  spread_trayport_r2?: number
}

const COLORS: Record<string, string> = {
  cost_all: "#4afe03",
  cost_fixed: "#0367fe",
  cost_variable: "#38fff8",
  spread_acp: "#ef4444",
  spread_trayport: "#facc15",
}

const ROUTE_2_DASH = "6 4"

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

function deduplicateWeekends<T extends Record<string, unknown>>(data: T[]) {
  const seen = new Set<string>()
  const excluded = new Set(["timestampUk", "timestampUtc", "counter", "snapshotId"])

  return data.filter((row) => {
    const timeStamp = dayjs(String(row.timestampUk), "YYYY-MM-DD HH:mm", true)
    if (!timeStamp.isValid()) return true

    const dow = timeStamp.day()
    const isWeekend = dow === 0 || dow === 6
    if (!isWeekend) return true

    const weekId = `${timeStamp.isoWeekYear()}-W${String(timeStamp.isoWeek()).padStart(2, "0")}`

    const baseKey = Object.keys(row)
      .filter((k) => !excluded.has(k))
      .sort()
      .map((k) => {
        const v = row[k]
        return `${k}=${typeof v === "number" ? String(v) : String(v).trim()}`
      })
      .join("|")

    const key = `${weekId}|${baseKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type RouteData = { costs: CostRow[]; spreads: SpreadRow[] }

function combineRouteIntoMap(route: RouteData, routeKey: RouteKey, map: Map<string, CombinedRow>) {
  const ensure = (timestampUk: string, tenor: string) => {
    if (!map.has(timestampUk)) map.set(timestampUk, { timestampUk, tenor })
    return map.get(timestampUk)!
  }
  const key = (base: string) => `${base}_${routeKey}` as keyof CombinedRow

  for (const c of route.costs) {
    const row = ensure(c.timestampUk, c.tenor)
    const t = normalizeCostType(c.costCalculationType)
    if (t === "all") row[key("cost_all")] = c.avg
    if (t === "fixed") row[key("cost_fixed")] = c.avg
    if (t === "variable") row[key("cost_variable")] = c.avg
  }

  for (const s of route.spreads) {
    const row = ensure(s.timestampUk, s.tenor)
    const m = normalizeMarket(s.source)
    if (m === "acp") row[key("spread_acp")] = s.avg
    if (m === "trayport") row[key("spread_trayport")] = s.avg
  }
}

function combineTwoRoutes(route1: RouteData, route2?: RouteData | null): CombinedRow[] {
  const map = new Map<string, CombinedRow>()
  combineRouteIntoMap(route1, "r1", map)
  if (route2) combineRouteIntoMap(route2, "r2", map)

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestampUk).getTime() - new Date(b.timestampUk).getTime()
  )
}

/** Canonical metrics (ONE legend item each) */
type MetricKey = "spread_acp" | "spread_trayport" | "cost_all" | "cost_fixed" | "cost_variable"

const METRICS: Array<{ key: MetricKey; label: string; colorKey: MetricKey }> = [
  { key: "spread_acp", label: "Spread ACP", colorKey: "spread_acp" },
  { key: "spread_trayport", label: "Spread Trayport", colorKey: "spread_trayport" },
  { key: "cost_all", label: "Cost All", colorKey: "cost_all" },
  { key: "cost_fixed", label: "Cost Fixed", colorKey: "cost_fixed" },
  { key: "cost_variable", label: "Cost Variable", colorKey: "cost_variable" },
]

function toR1(metric: MetricKey) {
  return `${metric}_r1` as keyof CombinedRow
}
function toR2(metric: MetricKey) {
  return `${metric}_r2` as keyof CombinedRow
}

/** Tooltip that shows Route 1 | Route 2 side-by-side */
function TwoRouteTooltip({
  active,
  label,
  payload,
  hasRoute2,
}: TooltipProps<number, string> & { hasRoute2: boolean }) {
  if (!active || !payload || payload.length === 0) return null

  const row = payload[0]?.payload as CombinedRow | undefined
  if (!row) return null

  const formatNum = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(4) : "—"

  return (
    <div
      style={{
        backgroundColor: "#111",
        borderRadius: 6,
        padding: "10px 12px",
        color: "#fff",
        boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
        minWidth: 320,
      }}
    >
      <div style={{ color: "#bbb", fontSize: 16, marginBottom: 8 }}>{label}</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasRoute2 ? "1.3fr 1fr 1fr" : "1.3fr 1fr",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div />
        <div style={{ color: "#bbb", fontSize: 12 }}>Route 1</div>
        {hasRoute2 ? <div style={{ color: "#bbb", fontSize: 12 }}>Route 2</div> : null}

        {METRICS.map((m) => {
          const v1 = row[`${m.key}_r1` as keyof CombinedRow]
          const v2 = row[`${m.key}_r2` as keyof CombinedRow]
          const color = COLORS[m.colorKey]

          return (
            <div key={m.key} style={{ display: "contents" }}>
              {/* colored name cell */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: color,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 12, color: "#ddd" }}>{m.label}</span>
              </div>

              <div style={{ fontSize: 12 }}>{formatNum(v1)}</div>
              {hasRoute2 ? <div style={{ fontSize: 12 }}>{formatNum(v2)}</div> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}


export default function CostsAndSpreadsChart() {
  const route1: RouteData = useMemo(
    () => ({
      costs: deduplicateWeekends(costsRawR1 as CostRow[]),
      spreads: deduplicateWeekends(spreadsRawR1 as SpreadRow[]),
    }),
    []
  )

  // Optional route2 (set to null when not available)
  const route2: RouteData | null = useMemo(
    () => ({
      costs: deduplicateWeekends(costsRawR2 as CostRow[]),
      spreads: deduplicateWeekends(spreadsRawR2 as SpreadRow[]),
    }),
    []
  )

  const hasRoute2 = Boolean(route2)
  const data = useMemo(() => combineTwoRoutes(route1, route2), [route1, route2])

  /**
   * One hidden flag per metric (legend does NOT duplicate).
   * Toggling "Spread ACP" hides BOTH r1 and r2 lines for that metric.
   */
  const [hidden, setHidden] = useState<Record<MetricKey, boolean>>({
    spread_acp: false,
    spread_trayport: false,
    cost_all: false,
    cost_fixed: false,
    cost_variable: false,
  })

  const toggleMetric = (metric: string) => {
    const m = metric as MetricKey
    setHidden((prev) => ({ ...prev, [m]: !prev[m] }))
  }

  /**
   * Your CustomLegend likely relies on payload.dataKey to toggle.
   * We want legend items to carry canonical keys (e.g. "spread_acp"),
   * NOT "spread_acp_r1".
   *
   * So: we render legend from route1 lines only, but set their dataKey
   * to the canonical metric key using `legendPayload` trick:
   * Recharts doesn't let us directly override dataKey for legend,
   * but we *can* set the Line's `dataKey` to r1 and use `name` to
   * identify metric — OR we keep dataKey canonical by using a "ghost" line.
   *
   * Easiest: keep route1 as legend owner, and in CustomLegend use `entry.value`
   * (the `name`) as the key. If you can change CustomLegend, do that.
   *
   * If you cannot change it, see note below after code.
   */
  const resolveLegendKey = (dk: DataKey<unknown> | undefined) => {
    if (typeof dk === "string") return dk
    if (typeof dk === "number") return String(dk)
    return null
  }

  return (
    <div style={{ width: "90%", height: 600 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid stroke="#ccc" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="5 5" />
          <XAxis dataKey="timestampUk" />
          <YAxis />

          <Tooltip
            animationEasing="linear"
            animationDuration={100}
            cursor={{ stroke: "#111", strokeOpacity: 0.15 }}
            content={(props) => <TwoRouteTooltip {...props} hasRoute2={hasRoute2} />}
          />

          <Legend
            content={(props) => (
              <CustomLegend
                payload={props.payload}
                hiddenKeys={hidden as unknown as Record<string, boolean>}
                onToggle={toggleMetric}
                keyResolver={resolveLegendKey}
              />
            )}
          />

          {METRICS.map((m) => (
            <Line
              key={`${m.key}-r1`}
              type="linear"
              dataKey={toR1(m.key) as string}
              name={m.key} // IMPORTANT: canonical key for legend toggle
              stroke={COLORS[m.colorKey]}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              hide={hidden[m.key]}
              isAnimationActive={false}
            />
          ))}

          {hasRoute2
            ? METRICS.map((m) => (
              <Line
                key={`${m.key}-r2`}
                type="linear"
                dataKey={toR2(m.key) as string}
                name={m.key}
                stroke={COLORS[m.colorKey]}
                strokeWidth={1.5}
                strokeDasharray={ROUTE_2_DASH}
                dot={false}
                connectNulls
                hide={hidden[m.key]}
                isAnimationActive={false}
                legendType="none"
              />
            ))
            : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
