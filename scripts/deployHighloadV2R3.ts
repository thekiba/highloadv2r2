import { toNano } from '@ton/core';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const highloadV2R3 = provider.open(
        HighloadV2R2.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('HighloadV2R3')
        )
    );

    await highloadV2R3.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(highloadV2R3.address);

    console.log('ID', await highloadV2R3.getID());
}
