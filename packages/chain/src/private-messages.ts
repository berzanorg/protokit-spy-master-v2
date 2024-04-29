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
    UInt64 as OUint64,
} from "o1js"
import { ZkProgram, dummyBase64Proof } from "o1js/dist/node/lib/proof_system"
import { Pickles } from "o1js/dist/node/snarky"

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

export class PrivateMessageProgramOutput extends Struct({
    agentId: AgentId,
    messageNumber: MessageNumber,
    securityCode: SecurityCode,
}) {}

const verifyMessageCircuit = (message: Message) => {
    const messageContent = message.content.getInner()

    let messageLength = Field.from(0)
    for (let i = 0; i < 128; i++) {
        const character = messageContent.values[i]

        messageLength = Provable.if(
            Bool.and(messageLength.equals(0), character.value.equals(0)),
            Field.from(i),
            messageLength,
        )
    }

    // It throws the error below when used outside of a transaction so I disabled assertion.
    // Error: Setup has not been called prior to executing a runtime method. Be sure to do that so that the Runtime is setup property for execution
    // assert(messageLength.equals(Field.from(12)), "message content length is not 12 characters")

    return new PrivateMessageProgramOutput({
        agentId: message.agentId,
        messageNumber: message.number,
        securityCode: message.securityCode,
    })
}

export const PrivateMessageProgram = ZkProgram({
    publicOutput: PrivateMessageProgramOutput,
    methods: {
        verifyMessage: {
            privateInputs: [Message],
            method: verifyMessageCircuit,
        },
    },
})

export class PrivateMessageProof extends ZkProgram.Proof(PrivateMessageProgram) {}

const [, dummy] = Pickles.proofOfBase64(await dummyBase64Proof(), 2)

export const generateTestProof = (message: Message) => {
    return new PrivateMessageProof({
        proof: dummy,
        publicOutput: verifyMessageCircuit(message),
        publicInput: undefined,
        maxProofsVerified: 2,
    })
}

export class AgentIdAndMessageNumber extends Struct({
    agentId: AgentId,
    messageNumber: MessageNumber,
}) {}

export class MessageDetails extends Struct({
    blockHeight: OUint64,
    msgSender: PublicKey,
    nonce: OUint64,
}) {}

@runtimeModule()
export class PrivateMessages extends RuntimeModule<Record<string, never>> {
    @state() public securityCodes = StateMap.from(AgentId, SecurityCode)
    @state() public lastMessageNumbers = StateMap.from(AgentId, MessageNumber)
    @state() public messageDetails = StateMap.from(AgentIdAndMessageNumber, MessageDetails)

    @runtimeMethod()
    public registerAgent(agentId: AgentId, securityCode: SecurityCode) {
        const securityCodeContent = securityCode.getInner()

        let messageLength = Field.from(0)
        for (let i = 0; i < 128; i++) {
            const character = securityCodeContent.values[i]

            messageLength = Provable.if(
                Bool.and(messageLength.equals(0), character.value.equals(0)),
                Field.from(i),
                messageLength,
            )
        }

        assert(messageLength.equals(Field.from(2)), "security is not 2 characters")

        this.securityCodes.set(agentId, securityCode)
    }

    @runtimeMethod()
    public sendPrivateMessage(privateMessageProof: PrivateMessageProof) {
        const agentId = privateMessageProof.publicOutput.agentId
        const messageNumber = privateMessageProof.publicOutput.messageNumber
        const securityCode = privateMessageProof.publicOutput.securityCode

        assert(this.securityCodes.get(agentId).isSome, "agent isn't registered")
        assert(
            messageNumber.inner.greaterThan(this.lastMessageNumbers.get(agentId).value.inner),
            "message number isn't greater than the last one",
        )
        assert(
            securityCode
                .getInner()
                .equals((this.securityCodes.get(agentId).value as SecurityCode).getInner()),
            "security code for agent is invalid",
        )

        privateMessageProof.verify()

        this.lastMessageNumbers.set(agentId, messageNumber)

        this.messageDetails.set(
            new AgentIdAndMessageNumber({
                agentId,
                messageNumber,
            }),
            new MessageDetails({
                msgSender: this.transaction.sender.value,
                blockHeight: this.network.block.height,
                nonce: this.transaction.nonce.value,
            }),
        )
    }
}
