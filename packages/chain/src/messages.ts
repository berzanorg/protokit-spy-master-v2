import { UInt32, UInt64 } from "@proto-kit/library"
import { RuntimeModule, runtimeMethod, runtimeModule, state } from "@proto-kit/module"
import { StateMap, assert } from "@proto-kit/protocol"
import {
    PublicKey,
    Struct,
    CircuitString,
    Character,
    Provable,
    Field,
    Bool,
    ProvableExtended,
} from "o1js"

export class AgentId extends Struct({
    inner: UInt32,
}) {}

export class MessageNumber extends Struct({
    inner: UInt32,
}) {}

export class MessageContent extends Struct({
    inner: CircuitString,
}) {
    getInner() {
        return this.inner as CircuitString
    }
}

export class SecurityCode extends Struct({
    inner: CircuitString,
}) {
    getInner() {
        return this.inner as CircuitString
    }
}

export class Message extends Struct({
    number: MessageNumber,
    agentId: AgentId,
    content: MessageContent,
    securityCode: SecurityCode,
}) {}

@runtimeModule()
export class Messages extends RuntimeModule<Record<string, never>> {
    @state() public securityCodes = StateMap.from(AgentId, SecurityCode)
    @state() public lastMessageNumbers = StateMap.from(AgentId, MessageNumber)

    @runtimeMethod()
    public registerAgent(agentId: AgentId, securityCode: SecurityCode) {
        this.securityCodes.set(agentId, securityCode)
    }

    @runtimeMethod()
    public sendMessage(message: Message) {
        assert(this.securityCodes.get(message.agentId).isSome, "agent isn't registered")

        const securityCodeForAgent = (
            this.securityCodes.get(message.agentId).value as SecurityCode
        ).getInner()

        const lastMessageNumbersOfAgent = this.lastMessageNumbers.get(message.agentId).value.inner

        const givenSecurityCode = message.securityCode.getInner()

        assert(securityCodeForAgent.equals(givenSecurityCode), "security code for agent is invalid")

        const messageContent = message.content.getInner()
        const messageNumber = message.number.inner

        let messageLength = Field.from(0)
        for (let i = 0; i < 128; i++) {
            const character = messageContent.values[i]

            messageLength = Provable.if(
                Bool.and(messageLength.equals(0), character.value.equals(0)),
                Field.from(i),
                messageLength,
            )
        }

        assert(messageLength.equals(Field.from(12)), "message content length is not 12 characters")

        assert(
            messageNumber.greaterThan(lastMessageNumbersOfAgent),
            "message number isn't greater than the last one",
        )

        this.lastMessageNumbers.set(message.agentId, new MessageNumber({ inner: messageNumber }))
    }
}
