import type { TooltipProps } from "recharts"
import type {
    NameType,
    ValueType,
} from "recharts/types/component/DefaultTooltipContent"
import { COLORS, METRICS } from "./constants"
import type { CombinedRow } from "./types"

export default function TwoRouteTooltip({
    active,
    label,
    payload,
    hasRoute2,
    hiddenKeys,
}: TooltipProps<ValueType, NameType> & {
    hasRoute2: boolean
    hiddenKeys: Record<string, boolean>
}) {
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
            <div style={{ color: "#bbb", fontSize: 16, marginBottom: 8 }}>
                {String(label ?? "")}
            </div>

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

                {METRICS.filter((m) => !hiddenKeys[m.key]).map((m) => {
                    const v1 = row[`${m.key}_r1` as keyof CombinedRow]
                    const v2 = row[`${m.key}_r2` as keyof CombinedRow]
                    const color = COLORS[m.colorKey]

                    return (
                        <div key={m.key} style={{ display: "contents" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color }}>{m.label}</span>
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
