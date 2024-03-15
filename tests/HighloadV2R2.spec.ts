import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, internal, SendMode, toNano } from '@ton/core';
import { HighloadV2R2, Opcodes } from '../wrappers/HighloadV2R2';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';

describe('HighloadV2R3', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('HighloadV2R2');
    });

    let secretKey: Buffer;
    let publicKey: Buffer;

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let highloadV2R2: SandboxContract<HighloadV2R2>;

    beforeEach(async () => {
        const keyPair = await mnemonicToWalletKey(await mnemonicNew());
        secretKey = keyPair.secretKey;
        publicKey = keyPair.publicKey;

        blockchain = await Blockchain.create();

        highloadV2R2 = blockchain.openContract(
            HighloadV2R2.createFromConfig(
                {
                    publicKey: publicKey
                },
                code
            )
        );

        deployer = await blockchain.treasury('deployer', { balance: toNano(1000000) });

        const deployResult = await highloadV2R2.sendDeploy(deployer.getSender(), toNano('1000'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            deploy: true,
            success: true
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and highloadV2R2 are ready to use
    });

    it('should send transfer', async () => {
        const transferResult = await highloadV2R2.sendTransfer({
            secretKey: secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [internal({
                to: deployer.address,
                value: toNano('1')
            })]
        });

        expect(transferResult.transactions).toHaveTransaction({
            from: undefined,
            to: highloadV2R2.address,
            success: true
        });
        expect(transferResult.transactions).toHaveTransaction({
            from: highloadV2R2.address,
            to: deployer.address,
            value: toNano('1')
        });
        expect(transferResult.transactions.length).toBe(2);
    });

    it('should accept transfer', async () => {
        const transferResult = await deployer.send({
            value: toNano('1'),
            to: highloadV2R2.address
        });

        expect(transferResult.transactions).toHaveTransaction({
            from: undefined,
            to: deployer.address,
            success: true
        });
        expect(transferResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            value: toNano('1'),
            success: true
        });
        expect(transferResult.transactions.length).toBe(2);
    });

    it('should cleanup queue when it is empty', async () => {
        const cleanupQueueResult = await highloadV2R2.sendCleanupQueue(deployer.getSender(), {
            limit: 100
        });

        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: undefined,
            to: deployer.address,
            success: true
        });
        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            success: true
        });
        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: highloadV2R2.address,
            to: deployer.address,
            success: true,
            body: checkExcesses()
        });
        expect(cleanupQueueResult.transactions.length).toBe(3);
    });

    it('should cleanup queue when it is not empty', async () => {
        // setup blockchain time
        if (!blockchain.now) {
            blockchain.now = Math.round(Date.now() / 1000);
        }
        let now = blockchain.now;

        // prepare queries
        const QUERIES_COUNT = 1000;
        const VALID_TIMEOUT_SEC = 60;
        const queries = [];
        for (let seqno = 0; seqno < QUERIES_COUNT; seqno++) {
            const queryId = (BigInt(now + VALID_TIMEOUT_SEC) << 32n) + BigInt(seqno);
            queries.push(queryId);
        }

        // send transfers
        for (const queryId of queries) {
            const seqno = Number(queryId & ((1n << 32n) - 1n));
            const validUntil = Number(queryId >> 32n);
            const timeout = validUntil - now;

            blockchain.now = now;

            const transferResult = await highloadV2R2.sendTransfer({
                secretKey: secretKey,
                sendMode: SendMode.PAY_GAS_SEPARATELY,
                seqno: seqno,
                now: now,
                timeout: timeout,
                messages: [internal({
                    to: highloadV2R2.address,
                    value: toNano('1')
                })]
            });

            expect(transferResult.transactions).toHaveTransaction({
                from: undefined,
                to: highloadV2R2.address,
                success: true
            });
            expect(transferResult.transactions).toHaveTransaction({
                from: highloadV2R2.address,
                to: highloadV2R2.address,
                value: toNano('1'),
                success: true
            });
            expect(transferResult.transactions.length).toBe(2);
        }

        // check that queue is not empty
        for (const queryId of queries) {
            blockchain.now = now;
            const processStatus = await highloadV2R2.getProcessedStatus(queryId);
            expect(processStatus).toBe('processed');
        }

        // send cleanup queue without time change
        blockchain.now = now;
        const cleanupQueueResult = await highloadV2R2.sendCleanupQueue(deployer.getSender(), {
            limit: 100
        });

        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: undefined,
            to: deployer.address,
            success: true
        });
        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            success: true
        });
        expect(cleanupQueueResult.transactions).toHaveTransaction({
            from: highloadV2R2.address,
            to: deployer.address,
            success: true,
            body: checkExcesses()
        });
        expect(cleanupQueueResult.transactions.length).toBe(3);

        // check that queue is not empty
        for (const queryId of queries) {
            blockchain.now = now;
            const processStatus = await highloadV2R2.getProcessedStatus(queryId);
            expect(processStatus).toBe('processed');
        }

        // skip time to the future
        blockchain.now = now + VALID_TIMEOUT_SEC + 64 + 2;
        now = blockchain.now;

        // send cleanup queue with time change
        const CLEANUP_LIMIT = 100;
        const cleanupQueueResult2 = await highloadV2R2.sendCleanupQueue(deployer.getSender(), {
            limit: CLEANUP_LIMIT
        });

        expect(cleanupQueueResult2.transactions).toHaveTransaction({
            from: undefined,
            to: deployer.address,
            success: true
        });
        expect(cleanupQueueResult2.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            success: true
        });
        expect(cleanupQueueResult2.transactions).toHaveTransaction({
            from: highloadV2R2.address,
            to: deployer.address,
            success: true,
            body: checkExcesses()
        });
        expect(cleanupQueueResult2.transactions.length).toBe(3);

        // check that queue is not empty except the first query
        for (const queryId of queries) {
            blockchain.now = now;
            const processStatus = await highloadV2R2.getProcessedStatus(queryId);

            // getting the current time
            let bound = BigInt(blockchain.now) << 32n;
            // clean up records expired more than 64 seconds ago
            bound -= (64n << 32n);

            const seqno = Number(queryId & ((1n << 32n) - 1n));

            if (queryId < bound && seqno < CLEANUP_LIMIT) {
                expect(processStatus).toBe('forgotten');
            } else {
                expect(processStatus).toBe('processed');
            }
        }
    });
});

function checkExcesses(queryId: number = 0) {
    return (cell?: Cell): boolean => {
        if (!cell) {
            return false;
        }

        const cs = cell.beginParse();

        const opcode = cs.loadUint(32);
        if (opcode !== Opcodes.excesses) {
            return false;
        }

        const qid = cs.loadUint(64);
        if (qid !== queryId) {
            return false;
        }

        return true;
    };
}
