import { Balance } from "@proto-kit/library"
import { Balances } from "./balances"
import { ModulesConfig } from "@proto-kit/common"
import { Messages } from "./messages"

export const modules = {
    Balances,
    Messages,
}

export const config: ModulesConfig<typeof modules> = {
    Balances: {
        totalSupply: Balance.from(10_000),
    },
    Messages: {},
}

export default {
    modules,
    config,
}
