import type { DataKey } from "recharts/types/util/types"

type LegendPayloadItem = {
    dataKey?: DataKey<unknown>
    value?: string
    color?: string
}

type CustomLegendProps = {
    payload?: LegendPayloadItem[]
    hiddenKeys: Record<string, boolean>
    onToggle: (key: string) => void
    keyResolver: (dataKey: DataKey<unknown> | undefined) => string | null
}

const LABELS: Record<string, string> = {
    spread_acp: "Spread ACP",
    spread_trayport: "Spread Trayport",
    cost_all: "Cost All",
    cost_fixed: "Cost Fixed",
    cost_variable: "Cost Variable",
}

export default function CustomLegend({
    payload,
    hiddenKeys,
    onToggle,
    keyResolver,
}: CustomLegendProps) {
    if (!payload || payload.length === 0) return null

    const resolveToggleKey = (entry: LegendPayloadItem) => {
        const v = (entry.value ?? "").trim()
        if (v) return v
        return keyResolver(entry.dataKey)
    }

    // ✅ Deduplicate legend items by the resolved key
    const unique = (() => {
        const seen = new Set<string>()
        const out: Array<{ entry: LegendPayloadItem; key: string }> = []
        for (const entry of payload) {
            const k = resolveToggleKey(entry)
            if (!k) continue
            if (seen.has(k)) continue
            seen.add(k)
            out.push({ entry, key: k })
        }
        return out
    })()

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingLeft: 55, paddingTop: 10 }}>
            {unique.map(({ entry, key }, idx) => {
                const isHidden = Boolean(hiddenKeys[key])
                const color = String(entry.color ?? "#111")

                return (
                    <button
                        key={`${key}-${idx}`}
                        type="button"
                        onClick={() => onToggle(key)}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            border: 0,
                            background: "transparent",
                            cursor: "pointer",
                            padding: "2px 4px",
                            opacity: isHidden ? 0.25 : 1,
                        }}
                        title="Toggle series"
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 1,
                                background: color,
                                display: "inline-block",
                            }}
                        />
                        <span style={{ fontSize: 14, color, lineHeight: 1 }}>{LABELS[entry.value || ""] ?? entry.value}</span>
                    </button>
                )
            })}
        </div>
    )
}
