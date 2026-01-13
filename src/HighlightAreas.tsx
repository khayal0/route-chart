import { PairHighlighter } from "./PairHiglighter"
import type { CombinedRow } from "./types"

type CostBase = "cost_all" | "cost_fixed" | "cost_variable"
type SpreadBase = "spread_acp" | "spread_trayport"
type RouteKey = "r1" | "r2"

type MultiRouteHighlighterProps = {
    data: CombinedRow[]
    enabled: boolean
    hasRoute2: boolean
    hidden: Record<string, boolean>
}

export default function MultiRouteHighlighter(
    props: MultiRouteHighlighterProps & Record<string, unknown>
) {
    const {
        enabled,
        hasRoute2,
        hidden,
    } = props

    if (!enabled) return null

    const spreads: SpreadBase[] = ["spread_acp", "spread_trayport"]
    const costs: CostBase[] = ["cost_all", "cost_fixed", "cost_variable"]
    const routes: RouteKey[] = hasRoute2 ? ["r1", "r2"] : ["r1"]
    const isVisible = (k: string) => !hidden[k]

    return (
        <>
            {routes.map((route) =>
                spreads.map((s) =>
                    costs.map((c) => {
                        const pairEnabled = enabled && isVisible(s) && isVisible(c)
                        if (!pairEnabled) return null

                        const aKey = `${s}_${route}` as keyof CombinedRow
                        const bKey = `${c}_${route}` as keyof CombinedRow

                        return (
                            <PairHighlighter
                                key={`${route}-${s}-${c}`}
                                aKey={aKey}
                                bKey={bKey}
                                {...props} // pass data and Recharts-injected props 
                            />
                        )
                    })
                )
            )}
        </>
    )
}
