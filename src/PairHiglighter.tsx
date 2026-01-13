import { useMemo } from "react"
import type { CombinedRow } from "./types"

type AxisLike = {
    id?: string
    scale?: (value: unknown) => number
}

type AxisMap = Record<string, AxisLike>
interface Props {
    data: CombinedRow[]
    enabled: boolean
    aKey: keyof CombinedRow
    bKey: keyof CombinedRow
}

export function PairHighlighter(props: Props) {
    const {
        data,
        aKey,
        bKey,
    } = props

    const { xAxisMap, yAxisMap } = props as unknown as {
        xAxisMap?: AxisMap
        yAxisMap?: AxisMap
    }

    // Injected by Recharts Customized
    const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : null
    const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : null


    type ConnectedPoint = { timestampUk: string; a: number; b: number }

    const connected: ConnectedPoint[] = useMemo(() => {
        const sx = xAxis?.scale as (v: unknown) => number

        const n = data.length
        const xs = new Array<number>(n)
        const aVals = new Array<number | null>(n)

        for (let i = 0; i < n; i++) {
            xs[i] = sx(data[i].timestampUk)
            const aRaw = data[i][aKey]
            aVals[i] = typeof aRaw === "number" ? aRaw : null
        }

        // Next valid A index for each i (right neighbor)
        const nextValidA = new Array<number>(n).fill(-1)
        let next = -1
        for (let i = n - 1; i >= 0; i--) {
            if (typeof aVals[i] === "number") next = i
            nextValidA[i] = next
        }

        const out: ConnectedPoint[] = []
        let lastB: number | null = null
        let prevA = -1

        for (let i = 0; i < n; i++) {
            // A: interpolate across gaps (true connectNulls)
            let aResolved: number | null = null
            const aRaw = aVals[i]

            if (typeof aRaw === "number") {
                aResolved = aRaw
                prevA = i
            } else {
                const left = prevA
                const right = nextValidA[i]
                if (left !== -1 && right !== -1 && right !== left) {
                    const xL = xs[left]
                    const xR = xs[right]
                    const xI = xs[i]
                    const aL = aVals[left] as number
                    const aR = aVals[right] as number
                    const denom = xR - xL
                    if (Number.isFinite(denom) && denom !== 0) {
                        const t = (xI - xL) / denom
                        if (Number.isFinite(t)) aResolved = aL + t * (aR - aL)
                    }
                }
            }

            // B: forward-fill
            const bRaw = data[i][bKey]
            const bResolved = typeof bRaw === "number" ? bRaw : lastB
            if (typeof bRaw === "number") lastB = bRaw

            if (typeof aResolved === "number" && typeof bResolved === "number") {
                out.push({ timestampUk: data[i].timestampUk, a: aResolved, b: bResolved })
            }
        }

        return out
    }, [data, aKey, bKey, xAxis?.scale])

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
        const sx = xAxis?.scale as (v: unknown) => number
        const sy = yAxis?.scale as (v: unknown) => number
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
    }, [connected, xAxis?.scale, yAxis?.scale])


    type StripPoint = { x: number; yTop: number; yBot: number }

    const { aboveStrips, belowStrips } = useMemo(() => {
        const splitAtCrossing = (s: Seg) => {
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

            const yCross = cross.yA

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
        <g >
            {aboveStrips.map((strip, idx) => (
                <path
                    key={`above-${idx}`}
                    d={buildPath(strip)}
                    fill={"#22c55e"}
                    fillOpacity={0.12}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
            {belowStrips.map((strip, idx) => (
                <path
                    key={`below-${idx}`}
                    d={buildPath(strip)}
                    fill={"#ef4444"}
                    fillOpacity={0.12}
                    stroke="none"
                    pointerEvents="none"
                />
            ))}
        </g>
    )
}
