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

        const deployResult = await highloadV2R2.sendDeploy(deployer.getSender(), toNano('100'));

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
                value: toNano('1'),
            })]
        });

        expect(transferResult.transactions.length).toBe(2);

        expect(transferResult.transactions).toHaveTransaction({
            from: undefined,
            to: highloadV2R2.address,
            success: true,
        });

        expect(transferResult.transactions).toHaveTransaction({
            from: highloadV2R2.address,
            to: deployer.address,
            value: toNano('1'),
        });
    });

    it('should accept transfer', async () => {
        const transferResult = await deployer.send({
            value: toNano('1'),
            to: highloadV2R2.address,
        });

        expect(transferResult.transactions.length).toBe(2);

        expect(transferResult.transactions).toHaveTransaction({
            from: undefined,
            to: deployer.address,
            success: true,
        });

        expect(transferResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadV2R2.address,
            value: toNano('1'),
            success: true,
        });
    });

    it('should cleanup queue when it is empty', async () => {
        const cleanupQueueResult = await highloadV2R2.sendCleanupQueue(deployer.getSender(), {
            limit: 100
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
    });

    it('should cleanup queue when it is not empty', async () => {

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
    }
}
