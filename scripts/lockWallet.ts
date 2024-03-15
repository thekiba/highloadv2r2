import { SendMode, internal, toNano } from '@ton/core';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { compile, NetworkProvider } from '@ton/blueprint';
import nacl, { randomBytes } from 'tweetnacl'
import { keyPairFromSeed } from '@ton/crypto';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const messagesCountString = await ui.input('Messages count')
    const messagesCount = parseInt(messagesCountString, 10)
    if (messagesCount < 1) {
        throw new Error('Unknown messages count')
    }

    const walletSeed = await ui.input('Seed in hex')
    const keyPair = keyPairFromSeed(Buffer.from(walletSeed, 'hex'))

    const highloadV2R3 = provider.open(
        HighloadV2R2.createFromConfig(
            {
               publicKey: keyPair.publicKey
            },
            await compile('HighloadV2R2')
        )
    );

    await highloadV2R3.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(highloadV2R3.address);

    for (let i = 0; i < messagesCount; i++) {
        highloadV2R3.sendTransfer({
            secretKey: keyPair.secretKey,
            messages: [internal({
                to: highloadV2R3.address,
                value: 1n
            })],
            seqno: i,
            sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
        })
    }
}
