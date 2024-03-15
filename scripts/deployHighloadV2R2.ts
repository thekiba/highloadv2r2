import { toNano } from '@ton/core';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { compile, NetworkProvider } from '@ton/blueprint';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';

export async function run(provider: NetworkProvider) {
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToWalletKey(mnemonic);

    const highloadV2R2 = provider.open(
        HighloadV2R2.createFromConfig(
            {
               publicKey: keyPair.publicKey
            },
            await compile('HighloadV2R2')
        )
    );

    console.log(`HighloadV2R2 deployed at address: ${highloadV2R2.address}`);
    console.log(`mnemonic: ${mnemonic.join(' ')}`);

    await highloadV2R2.sendDeploy(provider.sender(), toNano('0.05'));

    console.log(`Deploying HighloadV2R2...`);
    await provider.waitForDeploy(highloadV2R2.address);
}
