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
  Customized,
} from "recharts"
import customParseFormat from "dayjs/plugin/customParseFormat"
import isoWeek from "dayjs/plugin/isoWeek"
import dayjs from "dayjs"
import { costs as costsRawR1 } from "./data/cost.ts"
import { spreads as spreadsRawR1 } from "./data/spread.ts"
import { costs as costsRawR2 } from "./data/cost2.ts"
import { spreads as spreadsRawR2 } from "./data/spread2.ts"
import CustomLegend from "./CustomLegend.tsx"
import CustomTooltip from "./CustomTooltip.tsx"
import HighlightAreas from "./HighlightAreas.tsx"
import type { CombinedRow, MetricBase, MetricKeyForRoute, RouteData, RouteKey } from "./types.ts"
import { COLORS, METRICS } from "./constants.ts"
import "./App.css"

dayjs.extend(customParseFormat)
dayjs.extend(isoWeek)


function deduplicateWeekendData<T extends Record<string, unknown>>(data: T[]) {
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

function metricKey<R extends RouteKey>(base: MetricBase, routeKey: R): MetricKeyForRoute<R> {
  return `${base}_${routeKey}` as MetricKeyForRoute<R>
}

function combineRouteIntoMap(route: RouteData, routeKey: RouteKey, map: Map<string, CombinedRow>) {
  const ensure = (timestampUk: string, tenor: string) => {
    if (!map.has(timestampUk)) map.set(timestampUk, { timestampUk, tenor })
    return map.get(timestampUk)!
  }

  for (const c of route.costs) {
    const row = ensure(c.timestampUk, c.tenor)
    const t = c.costCalculationType?.toLowerCase();
    if (t === "all") row[metricKey("cost_all", routeKey)] = c.avg
    if (t === "fixed") row[metricKey("cost_fixed", routeKey)] = c.avg
    if (t === "variable") row[metricKey("cost_variable", routeKey)] = c.avg
  }

  for (const s of route.spreads) {
    const row = ensure(s.timestampUk, s.tenor)
    if (s.source?.toLowerCase() === "acp") row[metricKey("spread_acp", routeKey)] = s.avg
    if (s.source?.toLowerCase() === "trayport") row[metricKey("spread_trayport", routeKey)] = s.avg
  }
}

function combineTwoRoutes(route1: RouteData, route2?: RouteData | null): CombinedRow[] {
  const map = new Map<string, CombinedRow>()
  combineRouteIntoMap(route1, "r1", map)
  if (route2) combineRouteIntoMap(route2, "r2", map)

  return Array.from(map.values()).sort(
    (a, b) => dayjs(a.timestampUk).valueOf() - dayjs(b.timestampUk).valueOf()
  )
}

/** Canonical metrics (ONE legend item each) */
export type MetricKey = "spread_acp" | "spread_trayport" | "cost_all" | "cost_fixed" | "cost_variable" | "highlight" | "second_route";


function toR1(metric: MetricKey) {
  return `${metric}_r1`
}
function toR2(metric: MetricKey) {
  return `${metric}_r2`
}


export default function CostsAndSpreadsChart() {
  const [hidden, setHidden] = useState<Record<MetricKey, boolean>>({
    spread_acp: false,
    spread_trayport: true,
    cost_all: false,
    cost_fixed: true,
    cost_variable: true,
    highlight: false,
    second_route: true,
  })


  const route1: RouteData = useMemo(
    () => ({
      costs: deduplicateWeekendData(costsRawR1),
      spreads: deduplicateWeekendData(spreadsRawR1),
    }),
    []
  )

  const route2: RouteData | null = useMemo(() => {
    if ((!costsRawR2?.length && !spreadsRawR2?.length) || hidden.second_route) {
      return null;
    }
    return {
      costs: deduplicateWeekendData(costsRawR2),
      spreads: deduplicateWeekendData(spreadsRawR2),
    };
  }, [hidden])

  const hasRoute2 = Boolean(route2)
  const data = useMemo(() => combineTwoRoutes(route1, route2), [route1, route2])


  const toggleMetric = (metric: string) => {
    const m = metric as MetricKey
    setHidden((prev) => ({ ...prev, [m]: !prev[m] }))
  }

  return (
    <div style={{ width: "100%", height: 600 }}>
      <ResponsiveContainer>

        <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
          <Customized component={
            <HighlightAreas
              data={data}
              enabled={!hidden.highlight} hidden={hidden} hasRoute2={hasRoute2 && !hidden.second_route} />
          } />
          <CartesianGrid stroke="#ccc" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="5 5" />
          <XAxis dataKey="timestampUk" />
          <YAxis />
          <Tooltip
            animationEasing="linear"
            animationDuration={100}
            cursor={{ stroke: "#111", strokeOpacity: 0.15 }}
            content={(props) =>
              <CustomTooltip {...props} hasRoute2={hasRoute2} hiddenKeys={hidden} />
            }
          />
          <Legend
            content={(props) => (
              <CustomLegend
                payload={props.payload}
                hiddenKeys={hidden as unknown as Record<string, boolean>}
                onToggle={toggleMetric}
              />
            )}
          />
          {METRICS.map((m) => (
            <Line
              key={`${m.key}-r1`}
              type="linear"
              dataKey={toR1(m.key)}
              name={m.key} // Canonical key for legend toggle
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
                dataKey={toR2(m.key)}
                name={m.key}
                stroke={COLORS[m.colorKey]}
                strokeWidth={1.5}
                strokeDasharray="6 4"
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
