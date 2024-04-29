import { Balance } from "@proto-kit/library"
import { Balances } from "./balances"
import { ModulesConfig } from "@proto-kit/common"
import { PrivateMessages } from "./private-messages"

export const modules = {
    Balances,
    PrivateMessages,
}

export const config: ModulesConfig<typeof modules> = {
    Balances: {
        totalSupply: Balance.from(10_000),
    },
    PrivateMessages: {},
}

export default {
    modules,
    config,
}
