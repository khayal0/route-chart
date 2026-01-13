import { useMemo } from "react"
import type { CombinedRow } from "./App"

type Props = {
    data: CombinedRow[]
    enabled: boolean

    /**
     * Which route to compare. Defaults to r1.
     */
    route?: "r1" | "r2"

    /**
     * Which metrics to compare.
     * Defaults to spread_acp vs cost_fixed (as you said you changed it).
     */
    spreadBase?: "spread_acp" | "spread_trayport"
    costBase?: "cost_all" | "cost_fixed" | "cost_variable"

    /**
     * Mimic Recharts Line `connectNulls` behavior for BOTH series.
     * When true, null/missing values are bridged using the last known value,
     * matching the visual continuity you get from `connectNulls`.
     */
    connectNulls?: boolean

    /**
     * Fill opacity for highlight regions.
     */
    opacity?: number
}

/**
 * Highlights the area between two lines:
 * - green where spread > cost
 * - red otherwise
 *
 * Designed for <Customized component={<HighlightAreas ... />} />
 */
export default function HighlightAreas(props: Props & Record<string, unknown>) {
    const {
        data,
        enabled,
        route = "r1",
        spreadBase = "spread_acp",
        costBase = "cost_fixed",
        connectNulls = true,
        opacity = 0.5,
    } = props

    // Recharts injects these into Customized components:
    const xAxisMap = (props as { xAxisMap?: Record<string, any> }).xAxisMap
    const yAxisMap = (props as { yAxisMap?: Record<string, any> }).yAxisMap

    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null
    const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : null

    if (!enabled) return null
    if (!xAxis?.scale || !yAxis?.scale) return null
    if (!data || data.length < 2) return null

    const spreadKey = `${spreadBase}_${route}` as keyof CombinedRow
    const costKey = `${costBase}_${route}` as keyof CombinedRow

    type ConnectedPoint = { timestampUk: string; spread: number; cost: number }

    /**
     * Build a series that matches how Recharts draws when connectNulls is true:
     * - If a point is missing spread, use the last known spread
     * - If a point is missing cost, use the last known cost
     * - Only emit points where we have BOTH numbers at that x-position
     *
     * When connectNulls=false, only emit points where BOTH are present in the raw row.
     */
    const connected: ConnectedPoint[] = useMemo(() => {
        const out: ConnectedPoint[] = []
        let lastSpread: number | null = null
        let lastCost: number | null = null

        for (const row of data) {
            const sRaw = row[spreadKey]
            const cRaw = row[costKey]

            const s =
                typeof sRaw === "number" ? sRaw : connectNulls ? lastSpread : null
            const c =
                typeof cRaw === "number" ? cRaw : connectNulls ? lastCost : null

            if (typeof s === "number" && typeof c === "number") {
                out.push({ timestampUk: row.timestampUk, spread: s, cost: c })
            }

            if (typeof sRaw === "number") lastSpread = sRaw
            if (typeof cRaw === "number") lastCost = cRaw
        }

        return out
    }, [data, spreadKey, costKey, connectNulls])

    if (connected.length < 2) return null

    type Seg = {
        x0: number
        x1: number
        ySpread0: number
        ySpread1: number
        yCost0: number
        yCost1: number
        above0: boolean
        above1: boolean
    }

    const segments: Seg[] = useMemo(() => {
        const sx = xAxis.scale
        const sy = yAxis.scale
        const out: Seg[] = []

        for (let i = 0; i < connected.length - 1; i++) {
            const a = connected[i]
            const b = connected[i + 1]

            const x0 = sx(a.timestampUk)
            const x1 = sx(b.timestampUk)

            const ySpread0 = sy(a.spread)
            const ySpread1 = sy(b.spread)
            const yCost0 = sy(a.cost)
            const yCost1 = sy(b.cost)

            const above0 = a.spread > a.cost
            const above1 = b.spread > b.cost

            if (![x0, x1, ySpread0, ySpread1, yCost0, yCost1].every(Number.isFinite)) continue
            out.push({ x0, x1, ySpread0, ySpread1, yCost0, yCost1, above0, above1 })
        }

        return out
    }, [connected, xAxis.scale, yAxis.scale])

    if (segments.length === 0) return null

    // Find where (spread - cost) crosses 0 within a segment, in pixel space.
    const splitAtCrossing = (s: Seg) => {
        // diff is the vertical separation (cost - spread) in pixel space
        const diff0 = s.yCost0 - s.ySpread0
        const diff1 = s.yCost1 - s.ySpread1
        const denom = diff0 - diff1
        if (denom === 0) return null

        const t = diff0 / denom
        if (t <= 0 || t >= 1) return null

        const x = s.x0 + t * (s.x1 - s.x0)
        const ySpread = s.ySpread0 + t * (s.ySpread1 - s.ySpread0)
        const yCost = s.yCost0 + t * (s.yCost1 - s.yCost0)

        return { x, ySpread, yCost }
    }

    type StripPoint = { x: number; yTop: number; yBot: number }

    const { greenStrips, redStrips } = useMemo(() => {
        const green: StripPoint[][] = []
        const red: StripPoint[][] = []

        let current: StripPoint[] = []
        let currentIsGreen: boolean | null = null

        const flush = () => {
            if (currentIsGreen === null || current.length < 2) {
                current = []
                currentIsGreen = null
                return
            }
            ; (currentIsGreen ? green : red).push(current)
            current = []
            currentIsGreen = null
        }

        const pushPoint = (isGreen: boolean, p: StripPoint) => {
            if (currentIsGreen === null) {
                currentIsGreen = isGreen
                current = [p]
                return
            }
            if (currentIsGreen !== isGreen) {
                flush()
                currentIsGreen = isGreen
                current = [p]
                return
            }
            current.push(p)
        }

        for (const s of segments) {
            const isGreen0 = s.above0
            const isGreen1 = s.above1

            if (isGreen0 === isGreen1) {
                if (current.length === 0) {
                    pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
                }
                pushPoint(isGreen0, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
                continue
            }

            const cross = splitAtCrossing(s)
            if (!cross) {
                flush()
                pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
                pushPoint(isGreen0, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
                flush()
                continue
            }

            if (current.length === 0) {
                pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
            }
            pushPoint(isGreen0, { x: cross.x, yTop: cross.ySpread, yBot: cross.yCost })

            flush()

            pushPoint(isGreen1, { x: cross.x, yTop: cross.ySpread, yBot: cross.yCost })
            pushPoint(isGreen1, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
        }

        flush()
        return { greenStrips: green, redStrips: red }
    }, [segments])

    const buildPath = (strip: StripPoint[]) => {
        if (strip.length < 2) return ""
        const top = strip.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yTop}`).join(" ")
        const bottom = [...strip].reverse().map((p) => `L ${p.x} ${p.yBot}`).join(" ")
        return `${top} ${bottom} Z`
    }

    return (
        <g>
            {greenStrips.map((strip, idx) => (
                <path
                    key={`g-${idx}`}
                    d={buildPath(strip)}
                    fill="#11ec23"
                    fillOpacity={opacity}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
            {redStrips.map((strip, idx) => (
                <path
                    key={`r-${idx}`}
                    d={buildPath(strip)}
                    fill="#ef4444"
                    fillOpacity={opacity}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
        </g>
    )
}
