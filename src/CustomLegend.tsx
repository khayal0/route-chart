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
}: CustomLegendProps) {
    if (!payload || payload.length === 0) return null

    const resolveToggleKey = (entry: LegendPayloadItem) => {
        const v = (entry.value ?? "").trim()
        if (v) return v
        return entry.dataKey?.toString()
    }

    const unique = payload.reduce((acc, entry) => {
        const key = resolveToggleKey(entry)
        if (!key || acc.some(item => item.key === key)) return acc

        return [...acc, { entry, key }]
    }, [] as Array<{ entry: LegendPayloadItem; key: string }>)

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
