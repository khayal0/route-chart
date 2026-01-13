import React, { useMemo } from "react"
import type { CombinedRow } from "./App"

type Props = {
    data: CombinedRow[]
    enabled: boolean
    /**
     * Which route to compare. Defaults to r1.
     * If you ever want r2, pass route="r2".
     */
    route?: "r1" | "r2"
    /**
     * Optional opacity for the highlight fill.
     */
    opacity?: number
}

/**
 * Highlights the area between spread_acp and cost_all:
 * - green where spread_acp > cost_all
 * - red otherwise
 *
 * This component is designed to be used inside Recharts <Customized />.
 * Recharts injects chart internals (scales, offsets, etc.) as props at render time.
 */
export default function HighlightAreas(props: Props & Record<string, unknown>) {
    const { data, enabled, route = "r1", opacity = 0.18 } = props

    // Recharts injects these props into Customized components:
    const xAxisMap = (props as { xAxisMap?: Record<string, any> }).xAxisMap
    const yAxisMap = (props as { yAxisMap?: Record<string, any> }).yAxisMap
    const offset = (props as { offset?: { left: number; top: number; width: number; height: number } }).offset

    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null
    const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : null

    if (!enabled) return null
    if (!xAxis?.scale || !yAxis?.scale) return null
    if (!offset) return null
    if (!data || data.length < 2) return null

    const spreadKey = `spread_acp_${route}` as const
    const costKey = `cost_fixed_${route}` as const

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

    // Convert data points into pixel segments (adjacent pairs).
    const segments: Seg[] = useMemo(() => {
        const sx = xAxis.scale
        const sy = yAxis.scale

        const out: Seg[] = []

        for (let i = 0; i < data.length - 1; i++) {
            const a = data[i]
            const b = data[i + 1]

            const spreadA = a[spreadKey]
            const spreadB = b[spreadKey]
            const costA = a[costKey]
            const costB = b[costKey]

            // Need both series present at both ends to shade the interval.
            if (
                typeof spreadA !== "number" ||
                typeof spreadB !== "number" ||
                typeof costA !== "number" ||
                typeof costB !== "number"
            ) {
                continue
            }

            // X is timestamp; your XAxis uses dataKey="timestampUk"
            // so scale expects that raw value.
            const x0 = sx(a.timestampUk)
            const x1 = sx(b.timestampUk)

            // Y scale returns pixel y
            const ySpread0 = sy(spreadA)
            const ySpread1 = sy(spreadB)
            const yCost0 = sy(costA)
            const yCost1 = sy(costB)

            const above0 = spreadA > costA
            const above1 = spreadB > costB

            // Skip degenerate segments
            if (![x0, x1, ySpread0, ySpread1, yCost0, yCost1].every((v) => Number.isFinite(v))) continue

            out.push({ x0, x1, ySpread0, ySpread1, yCost0, yCost1, above0, above1 })
        }

        return out
    }, [data, xAxis.scale, yAxis.scale, spreadKey, costKey])

    if (segments.length === 0) return null

    // Helper: linear interpolation for the crossing point where (spread - cost) == 0
    const splitAtCrossing = (s: Seg) => {
        // We interpolate in *value space* but we already have pixel y for both lines.
        // If sign changes, find t where spread==cost based on their differences.
        // diff(t) = diff0 + t*(diff1-diff0) => t = diff0/(diff0-diff1)
        const diff0 = s.yCost0 - s.ySpread0
        const diff1 = s.yCost1 - s.ySpread1

        // If diff0==diff1, no crossing (parallel in pixel space)
        const denom = diff0 - diff1
        if (denom === 0) return null

        const t = diff0 / denom
        if (t <= 0 || t >= 1) return null

        const x = s.x0 + t * (s.x1 - s.x0)
        const ySpread = s.ySpread0 + t * (s.ySpread1 - s.ySpread0)
        const yCost = s.yCost0 + t * (s.yCost1 - s.yCost0)

        return { t, x, ySpread, yCost }
    }

    // Build two sets of polygons (paths): green and red.
    // Each polygon is a strip between the two lines for a run of segments.
    type StripPoint = { x: number; yTop: number; yBot: number }
    const { greenStrips, redStrips } = useMemo(() => {
        const green: StripPoint[][] = []
        const red: StripPoint[][] = []

        let current: StripPoint[] = []
        let currentIsGreen: boolean | null = null

        const flush = () => {
            if (current.length < 2 || currentIsGreen === null) {
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

            // If same side across the whole segment, just add endpoints.
            if (isGreen0 === isGreen1) {
                // ensure continuity: add start if new run, otherwise just append end
                if (current.length === 0) {
                    pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
                }
                pushPoint(isGreen0, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
                continue
            }

            // Side changes within segment -> split at crossing
            const cross = splitAtCrossing(s)
            if (!cross) {
                // fallback: treat as two separate tiny segments without crossing point
                flush()
                pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
                pushPoint(isGreen0, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
                flush()
                continue
            }

            // Part 1: start -> crossing
            if (current.length === 0) {
                pushPoint(isGreen0, { x: s.x0, yTop: s.ySpread0, yBot: s.yCost0 })
            }
            pushPoint(isGreen0, { x: cross.x, yTop: cross.ySpread, yBot: cross.yCost })

            // Switch color at crossing
            flush()

            // Part 2: crossing -> end
            pushPoint(isGreen1, { x: cross.x, yTop: cross.ySpread, yBot: cross.yCost })
            pushPoint(isGreen1, { x: s.x1, yTop: s.ySpread1, yBot: s.yCost1 })
        }

        flush()
        return { greenStrips: green, redStrips: red }
    }, [segments, splitAtCrossing])

    const buildPath = (strip: { x: number; yTop: number; yBot: number }[]) => {
        if (strip.length < 2) return ""

        // Top edge: left -> right along spread
        const top = strip.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yTop}`).join(" ")

        // Bottom edge: right -> left along cost
        const bottom = [...strip]
            .reverse()
            .map((p) => `L ${p.x} ${p.yBot}`)
            .join(" ")

        return `${top} ${bottom} Z`
    }

    return (
        <g clipPath={`url(#clipPath-${xAxis?.id ?? "0"})`}>
            {greenStrips.map((strip, idx) => (
                <path
                    key={`g-${idx}`}
                    d={buildPath(strip)}
                    fill="#22c55e"
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
