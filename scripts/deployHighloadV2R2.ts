import { toNano } from '@ton/core';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { compile, NetworkProvider } from '@ton/blueprint';
import nacl, { randomBytes } from 'tweetnacl'

export async function run(provider: NetworkProvider) {
    const key = nacl.sign.keyPair.fromSeed(Buffer.from(randomBytes(32)))
    const keyPair = {
        publicKey: Buffer.from(key.publicKey),
        secretKey: Buffer.from(key.secretKey),
    }

    const highloadV2R3 = provider.open(
        HighloadV2R2.createFromConfig(
            {
               publicKey: keyPair.publicKey
            },
            await compile('HighloadV2R3')
        )
    );

    await highloadV2R3.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(highloadV2R3.address);

}
