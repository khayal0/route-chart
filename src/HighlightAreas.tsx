import React, { useMemo } from "react"
import type { CombinedRow } from "./App"

type PairHighlighterProps = {
    data: CombinedRow[]
    enabled: boolean

    /**
     * Compare aKey vs bKey at each timestamp:
     * green where aKey > bKey, red otherwise.
     */
    aKey: keyof CombinedRow
    bKey: keyof CombinedRow

    /**
     * Visuals
     */
    aboveColor?: string
    belowColor?: string
    opacity?: number

    /**
     * For stable React keys / debugging
     */
    id: string
}

/**
 * PairHighlighter
 * Shades the area between two series (aKey and bKey):
 * - green where A > B
 * - red where A <= B
 *
 * Notes:
 * - Always mimics Line `connectNulls` (bridges missing values using last-known values).
 * - Intended for Recharts <Customized component={<PairHighlighter ... />} /> usage.
 */
export function PairHighlighter(props: PairHighlighterProps & Record<string, unknown>) {
    const {
        data,
        enabled,
        aKey,
        bKey,
        aboveColor = "#22c55e",
        belowColor = "#ef4444",
        opacity = 0.12,
        id,
    } = props

    // Injected by Recharts Customized
    const xAxisMap = (props as { xAxisMap?: Record<string, any> }).xAxisMap
    const yAxisMap = (props as { yAxisMap?: Record<string, any> }).yAxisMap
    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null
    const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : null

    if (!enabled) return null
    if (!xAxis?.scale || !yAxis?.scale) return null
    if (!data || data.length < 2) return null

    type ConnectedPoint = { timestampUk: string; a: number; b: number }

    /**
     * Always "connectNulls":
     * - If a is missing at timestamp i, use last known a
     * - If b is missing at timestamp i, use last known b
     * - Emit point only when both are available
     */
    const connected: ConnectedPoint[] = useMemo(() => {
        const out: ConnectedPoint[] = []
        let lastA: number | null = null
        let lastB: number | null = null

        for (const row of data) {
            const aRaw = row[aKey]
            const bRaw = row[bKey]

            const a = typeof aRaw === "number" ? aRaw : lastA
            const b = typeof bRaw === "number" ? bRaw : lastB

            if (typeof a === "number" && typeof b === "number") {
                out.push({ timestampUk: row.timestampUk, a, b })
            }

            if (typeof aRaw === "number") lastA = aRaw
            if (typeof bRaw === "number") lastB = bRaw
        }

        return out
    }, [data, aKey, bKey])

    if (connected.length < 2) return null

    type Seg = {
        x0: number
        x1: number
        yA0: number
        yA1: number
        yB0: number
        yB1: number
        above0: boolean
        above1: boolean
    }

    const segments: Seg[] = useMemo(() => {
        const sx = xAxis.scale
        const sy = yAxis.scale
        const out: Seg[] = []

        for (let i = 0; i < connected.length - 1; i++) {
            const p0 = connected[i]
            const p1 = connected[i + 1]

            const x0 = sx(p0.timestampUk)
            const x1 = sx(p1.timestampUk)

            const yA0 = sy(p0.a)
            const yA1 = sy(p1.a)
            const yB0 = sy(p0.b)
            const yB1 = sy(p1.b)

            const above0 = p0.a > p0.b
            const above1 = p1.a > p1.b

            if (![x0, x1, yA0, yA1, yB0, yB1].every(Number.isFinite)) continue
            out.push({ x0, x1, yA0, yA1, yB0, yB1, above0, above1 })
        }

        return out
    }, [connected, xAxis.scale, yAxis.scale])

    if (segments.length === 0) return null

    // Find crossing where (A - B) changes sign inside a segment (pixel-space linear interpolation).
    const splitAtCrossing = (s: Seg) => {
        // diff is vertical separation (B - A) in pixel space
        const diff0 = s.yB0 - s.yA0
        const diff1 = s.yB1 - s.yA1
        const denom = diff0 - diff1
        if (denom === 0) return null

        const t = diff0 / denom
        if (t <= 0 || t >= 1) return null

        const x = s.x0 + t * (s.x1 - s.x0)
        const yA = s.yA0 + t * (s.yA1 - s.yA0)
        const yB = s.yB0 + t * (s.yB1 - s.yB0)

        return { x, yA, yB }
    }

    type StripPoint = { x: number; yTop: number; yBot: number }

    const { aboveStrips, belowStrips } = useMemo(() => {
        const above: StripPoint[][] = []
        const below: StripPoint[][] = []

        let current: StripPoint[] = []
        let currentIsAbove: boolean | null = null

        const flush = () => {
            if (currentIsAbove === null || current.length < 2) {
                current = []
                currentIsAbove = null
                return
            }
            ; (currentIsAbove ? above : below).push(current)
            current = []
            currentIsAbove = null
        }

        const pushPoint = (isAbove: boolean, p: StripPoint) => {
            if (currentIsAbove === null) {
                currentIsAbove = isAbove
                current = [p]
                return
            }
            if (currentIsAbove !== isAbove) {
                flush()
                currentIsAbove = isAbove
                current = [p]
                return
            }
            current.push(p)
        }

        for (const s of segments) {
            const isAbove0 = s.above0
            const isAbove1 = s.above1

            // Choose which line is "top" and which is "bottom" for the filled band:
            // If A is above B, top=A bottom=B; else top=B bottom=A.
            const top0 = isAbove0 ? s.yA0 : s.yB0
            const bot0 = isAbove0 ? s.yB0 : s.yA0
            const top1 = isAbove1 ? s.yA1 : s.yB1
            const bot1 = isAbove1 ? s.yB1 : s.yA1

            if (isAbove0 === isAbove1) {
                if (current.length === 0) pushPoint(isAbove0, { x: s.x0, yTop: top0, yBot: bot0 })
                pushPoint(isAbove0, { x: s.x1, yTop: top1, yBot: bot1 })
                continue
            }

            const cross = splitAtCrossing(s)
            if (!cross) {
                flush()
                pushPoint(isAbove0, { x: s.x0, yTop: top0, yBot: bot0 })
                pushPoint(isAbove0, { x: s.x1, yTop: top1, yBot: bot1 })
                flush()
                continue
            }

            // At the crossing A==B, so yTop==yBot for that point.
            const yCross = cross.yA // equals cross.yB (numerically close)

            if (current.length === 0) pushPoint(isAbove0, { x: s.x0, yTop: top0, yBot: bot0 })
            pushPoint(isAbove0, { x: cross.x, yTop: yCross, yBot: yCross })

            flush()

            pushPoint(isAbove1, { x: cross.x, yTop: yCross, yBot: yCross })
            pushPoint(isAbove1, { x: s.x1, yTop: top1, yBot: bot1 })
        }

        flush()
        return { aboveStrips: above, belowStrips: below }
    }, [segments])

    const buildPath = (strip: StripPoint[]) => {
        if (strip.length < 2) return ""
        const top = strip.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yTop}`).join(" ")
        const bottom = [...strip].reverse().map((p) => `L ${p.x} ${p.yBot}`).join(" ")
        return `${top} ${bottom} Z`
    }

    return (
        <g data-pair-highlighter={id}>
            {aboveStrips.map((strip, idx) => (
                <path
                    key={`${id}-above-${idx}`}
                    d={buildPath(strip)}
                    fill={aboveColor}
                    fillOpacity={opacity}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
            {belowStrips.map((strip, idx) => (
                <path
                    key={`${id}-below-${idx}`}
                    d={buildPath(strip)}
                    fill={belowColor}
                    fillOpacity={opacity}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
        </g>
    )
}

type CostBase = "cost_all" | "cost_fixed" | "cost_variable"
type SpreadBase = "spread_acp" | "spread_trayport"

type MultiHighlighterProps = {
    data: CombinedRow[]
    enabled: boolean
    route?: "r1" | "r2"

    /**
     * Your hidden state, using canonical metric keys (no _r1/_r2 suffix)
     * Example keys: spread_acp, spread_trayport, cost_all, cost_fixed, cost_variable
     */
    hidden: Record<string, boolean>

    /**
     * Optional per-cost opacity (helps prevent "mud" when 3 bands overlap)
     */
    opacityByCost?: Partial<Record<CostBase, number>>
}

/**
 * MultiHighlighter
 * Renders up to 6 PairHighlighter overlays:
 * - spread_acp vs (all, fixed, variable)
 * - spread_trayport vs (all, fixed, variable)
 *
 * Each pair is enabled only when BOTH metrics are visible and enabled=true.
 */
export default function MultiHighlighter(props: MultiHighlighterProps & Record<string, unknown>) {
    const {
        data,
        enabled,
        hidden,
        route = "r1",
        opacityByCost = {
            cost_all: 0.08,
            cost_fixed: 0.1,
            cost_variable: 0.12,
        },
    } = props

    if (!enabled) return null

    const spreads: SpreadBase[] = ["spread_acp", "spread_trayport"]
    const costs: CostBase[] = ["cost_all", "cost_fixed", "cost_variable"]

    const isVisible = (key: string) => !hidden[key]

    return (
        <>
            {spreads.map((s) =>
                costs.map((c) => {
                    const pairEnabled = enabled && isVisible(s) && isVisible(c)
                    if (!pairEnabled) return null

                    const aKey = `${s}_${route}` as keyof CombinedRow
                    const bKey = `${c}_${route}` as keyof CombinedRow

                    return (
                        <PairHighlighter
                            key={`${s}-${c}-${route}`}
                            id={`${s}-${c}-${route}`}
                            data={data}
                            enabled={pairEnabled}
                            aKey={aKey}
                            bKey={bKey}
                            opacity={opacityByCost[c] ?? 0.1}
                            {...props} // pass through injected Recharts Customized props (xAxisMap/yAxisMap/etc)
                        />
                    )
                })
            )}
        </>
    )
}
