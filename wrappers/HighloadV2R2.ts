import {
    Address,
    beginCell,
    Builder,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    internal, loadMessageRelaxed,
    MessageRelaxed,
    Sender,
    SenderArguments,
    SendMode,
    Slice, storeMessageRelaxed
} from '@ton/core';
import { sign } from '@ton/crypto';

export type HighloadV2R3Config = {
    walletId: number;
    publicKey: Buffer;
};

export function highloadV2R3ConfigToCell(config: HighloadV2R3Config): Cell {
    return beginCell()
        .storeUint(config.walletId, 32)
        .storeUint(0, 64)
        .storeBuffer(config.publicKey, 32)
        .storeDict(null)
        .endCell();
}

export function highloadV2R3ConfigFromCell(cs: Slice): HighloadV2R3Config {
    const walletId = cs.loadUint(32);
    cs.skip(64);
    const publicKey = cs.loadBuffer(32);
    return { walletId, publicKey };
}

export const Opcodes = {
    cleanupQueue: 0x56cda31a,
    excesses: 0xd53276db
};

export class HighloadV2R2 implements Contract {

    public readonly address: Address;
    public readonly init?: { code: Cell, data: Cell };

    static createFromConfig(config: { walletId?: number, publicKey: Buffer }, code: Cell, workchain = 0) {
        let walletId = config.walletId;
        if (walletId !== null && walletId !== undefined) {
            walletId = walletId;
        } else {
            walletId = 698983191 + workchain;
        }

        const data = highloadV2R3ConfigToCell({ walletId: walletId, publicKey: config.publicKey });
        const init = { code, data };
        return new HighloadV2R2(contractAddress(workchain, init), init);
    }

    static createFromAddress(address: Address) {
        return new HighloadV2R2(address);
    }

    constructor(address: Address, init?: { code: Cell; data: Cell }) {
        this.address = address;
        this.init = init;
    }

    public async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        });
    }


    /**
     * Get wallet balance.
     */
    public async getBalance(provider: ContractProvider): Promise<bigint> {
        const state = await provider.getState();
        return state.balance;
    }

    /**
     * Send signed message.
     */
    public async send(provider: ContractProvider, message: Cell): Promise<void> {
        await provider.external(message);
    }

    /**
     * Sign and send message.
     */
    public async sendTransfer(provider: ContractProvider, args: {
        secretKey: Buffer;
        messages: MessageRelaxed[];
        seqno?: number | null;
        sendMode?: SendMode | null;
        timeout?: number | null;
    }) {
        const message = this.createTransfer(args);
        await this.send(provider, message);
    }

    /**
     * Create signed message.
     */
    public createTransfer(args: {
        secretKey: Buffer;
        messages: MessageRelaxed[];
        seqno?: number | null;
        sendMode?: SendMode | null;
        now?: number | null;
        timeout?: number | null;
    }): Cell {
        if (!this.init) {
            throw new Error('Contract is not initialized');
        }
        const config = highloadV2R3ConfigFromCell(this.init.data.beginParse());
        const { walletId } = config;

        let seqno = Math.floor(Math.random() * (1 << 32));
        if (args.seqno !== null && args.seqno !== undefined) {
            seqno = args.seqno;
        }

        let timeout = 5 * 60; // 15 minutes
        if (args.timeout !== null && args.timeout !== undefined && args.timeout < timeout) {
            timeout = args.timeout;
        }

        let sendMode: SendMode = SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS;
        if (args.sendMode !== null && args.sendMode !== undefined) {
            sendMode = args.sendMode;
        }

        let now = Date.now();
        if (args.now !== null && args.now !== undefined) {
            now = args.now;
        }

        return beginCell().store(storeSignedTransferHighloadWalletV2({
            secretKey: args.secretKey,
            messages: args.messages,
            seqno: seqno,
            sendMode: sendMode,
            timeout: timeout,
            walletId: walletId,
            now: now
        })).endCell();
    }

    /**
     * Load signed message.
     */
    public loadTransfer(src: Slice) {
        return loadSignedTransferHighloadWalletV2(src);
    }

    /**
     * Get processed status of message.
     */
    public async getProcessedStatus(provider: ContractProvider, queryId: bigint) {
        const { stack } = await provider.get('processed?', [{ type: 'int', value: queryId }]);

        const processedStatus = stack.readBigNumber();
        switch (processedStatus) {
            case -1n:
                return 'processed';
            case 0n:
                return 'unprocessed';
            case 1n:
                return 'forgotten';
            default:
                throw new Error('Unknown processed status ' + processedStatus);
        }
    }

    /**
     * Create sender.
     */
    sender(provider: ContractProvider, secretKey: Buffer): Sender {
        return {
            send: async (args: SenderArguments) => {
                await this.sendTransfer(provider, {
                    secretKey: secretKey,
                    sendMode: args.sendMode,
                    messages: [internal({
                        to: args.to,
                        value: args.value,
                        bounce: args.bounce,
                        init: args.init,
                        body: args.body
                    })]
                });
            },
            address: this.address
        };
    }

}


type MessageRelaxedValue = {
    sendMode: SendMode;
    message: MessageRelaxed;
}

function createMessageRelaxedValue() {
    return {
        serialize: (args: MessageRelaxedValue, builder: Builder) => {
            const { sendMode, message } = args;
            const messageRelaxed = beginCell().storeWritable(storeMessageRelaxed(message));

            builder.storeUint(sendMode, 8);
            builder.storeRef(messageRelaxed);
        },
        parse: (src: Slice): MessageRelaxedValue => {
            const sendMode = src.loadUint(8);
            const message = loadMessageRelaxed(src.loadRef().beginParse());
            return { sendMode, message };
        }
    };
}

function getQueryId(now: number, timeout: number, seqno: number) {
    const validUntil = Math.floor(now / 1000) + timeout;
    return (BigInt(validUntil) << 32n) + BigInt(seqno);
}

function storeSignedTransferHighloadWalletV2(args: {
    secretKey: Buffer;
    messages: MessageRelaxed[];
    seqno: number;
    sendMode: SendMode;
    now: number;
    timeout: number;
    walletId: number;
}) {
    return (builder: Builder) => {
        const { secretKey, messages, seqno, sendMode, now, timeout, walletId } = args;
        const queryId = getQueryId(now, timeout, seqno);

        const dict = Dictionary.empty(Dictionary.Keys.Int(16), createMessageRelaxedValue());
        for (const [i, message] of messages.entries()) {
            dict.set(i, { sendMode, message });
        }
        const signedMessage = beginCell()
            .storeUint(walletId, 32)
            .storeUint(queryId, 64)
            .storeDict(dict)
            .endCell();
        const hash = signedMessage.hash();
        const signature = sign(hash, secretKey);

        builder.storeBuffer(signature);
        builder.storeSlice(signedMessage.beginParse());
    };
}

function loadSignedTransferHighloadWalletV2(src: Slice) {
    const signature = src.loadBuffer(64);
    const walletId = src.loadUint(32);
    const queryId = src.loadUintBig(64);

    const dict = src.loadDict(Dictionary.Keys.Int(16), createMessageRelaxedValue());
    const messages: MessageRelaxedValue[] = dict.values();

    return {
        signature: signature,
        walletId: walletId,
        queryId: queryId,
        messages: messages
    };
}
