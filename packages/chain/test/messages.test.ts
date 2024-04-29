import { TestingAppChain } from "@proto-kit/sdk"
import { CircuitString, PrivateKey } from "o1js"
import { Balances } from "../src/balances"
import {
    AgentId,
    Message,
    MessageContent,
    MessageNumber,
    Messages,
    SecurityCode,
} from "../src/messages"
import { log } from "@proto-kit/common"
import { BalancesKey, TokenId, UInt32, UInt64 } from "@proto-kit/library"

log.setLevel("ERROR")

describe("balances", () => {
    it("should demonstrate how balances work", async () => {
        const appChain = TestingAppChain.fromRuntime({
            Balances,
            Messages,
        })

        appChain.configurePartial({
            Runtime: {
                Balances: {
                    totalSupply: UInt64.from(0),
                },
                Messages: {},
            },
        })

        await appChain.start()

        const kingPrivateKey = PrivateKey.random()
        const king = kingPrivateKey.toPublicKey()

        const jamesPrivateKey = PrivateKey.random()
        const james = jamesPrivateKey.toPublicKey()

        const messages = appChain.runtime.resolve("Messages")

        // James Bond can't send messages when he isn't registered as an agent:
        appChain.setSigner(jamesPrivateKey)
        const tx1 = await appChain.transaction(james, () => {
            messages.sendMessage(
                new Message({
                    number: new MessageNumber({ inner: UInt32.from(1) }),
                    agentId: new AgentId({ inner: UInt32.from(7) }),
                    content: new MessageContent({
                        inner: CircuitString.fromString("iamjamesbond"),
                    }),
                    securityCode: new SecurityCode({
                        inner: CircuitString.fromString("jb"),
                    }),
                }),
            )
        })

        await tx1.sign()
        await tx1.send()

        const block1 = await appChain.produceBlock()

        expect(block1?.transactions[0].status.toBoolean()).toBe(false)
        expect(block1!.transactions[0].statusMessage).toBe("agent isn't registered")

        // King registers James Bond:
        appChain.setSigner(kingPrivateKey)
        const tx2 = await appChain.transaction(king, () => {
            messages.registerAgent(
                new AgentId({ inner: UInt32.from(7) }),
                new SecurityCode({ inner: CircuitString.fromString("jb") }),
            )
        })

        await tx2.sign()
        await tx2.send()

        const block2 = await appChain.produceBlock()

        expect(block2?.transactions[0].status.toBoolean()).toBe(true)

        // James Bond sends valid message:
        appChain.setSigner(jamesPrivateKey)
        const tx3 = await appChain.transaction(james, () => {
            messages.sendMessage(
                new Message({
                    number: new MessageNumber({ inner: UInt32.from(1) }),
                    agentId: new AgentId({ inner: UInt32.from(7) }),
                    content: new MessageContent({
                        inner: CircuitString.fromString("iamjamesbond"),
                    }),
                    securityCode: new SecurityCode({
                        inner: CircuitString.fromString("jb"),
                    }),
                }),
            )
        })

        await tx3.sign()
        await tx3.send()

        const block3 = await appChain.produceBlock()

        expect(block3?.transactions[0].status.toBoolean()).toBe(true)

        // James Bond can't send messages when security code is invalid:
        appChain.setSigner(jamesPrivateKey)
        const tx4 = await appChain.transaction(james, () => {
            messages.sendMessage(
                new Message({
                    number: new MessageNumber({ inner: UInt32.from(2) }),
                    agentId: new AgentId({ inner: UInt32.from(7) }),
                    content: new MessageContent({
                        inner: CircuitString.fromString("iamjamesbond"),
                    }),
                    securityCode: new SecurityCode({
                        inner: CircuitString.fromString("aa"),
                    }),
                }),
            )
        })

        await tx4.sign()
        await tx4.send()

        const block4 = await appChain.produceBlock()

        expect(block4?.transactions[0].status.toBoolean()).toBe(false)
        expect(block4!.transactions[0].statusMessage).toBe("security code for agent is invalid")

        // James Bond can't send messages when message content length is not 12 characters:
        appChain.setSigner(jamesPrivateKey)
        const tx5 = await appChain.transaction(james, () => {
            messages.sendMessage(
                new Message({
                    number: new MessageNumber({ inner: UInt32.from(3) }),
                    agentId: new AgentId({ inner: UInt32.from(7) }),
                    content: new MessageContent({
                        inner: CircuitString.fromString("iamjames"),
                    }),
                    securityCode: new SecurityCode({
                        inner: CircuitString.fromString("jb"),
                    }),
                }),
            )
        })

        await tx5.sign()
        await tx5.send()

        const block5 = await appChain.produceBlock()

        expect(block5?.transactions[0].status.toBoolean()).toBe(false)
        expect(block5!.transactions[0].statusMessage).toBe(
            "message content length is not 12 characters",
        )

        // James Bond can't send messages when message number isn't greater than the last one:
        appChain.setSigner(jamesPrivateKey)
        const tx6 = await appChain.transaction(james, () => {
            messages.sendMessage(
                new Message({
                    number: new MessageNumber({ inner: UInt32.from(0) }),
                    agentId: new AgentId({ inner: UInt32.from(7) }),
                    content: new MessageContent({
                        inner: CircuitString.fromString("iamjamesbond"),
                    }),
                    securityCode: new SecurityCode({
                        inner: CircuitString.fromString("jb"),
                    }),
                }),
            )
        })

        await tx6.sign()
        await tx6.send()

        const block6 = await appChain.produceBlock()

        expect(block6?.transactions[0].status.toBoolean()).toBe(false)
        expect(block6!.transactions[0].statusMessage).toBe(
            "message number isn't greater than the last one",
        )
    }, 1_000_000)
})
