import { NetworkProvider } from '@ton/blueprint';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider, args: string[]) {
    const walletAddress = Address.parse(args[0]);

    const highloadV2R2 = provider.open(
        HighloadV2R2.createFromAddress(walletAddress)
    );

    while (true) {
        await highloadV2R2.sendCleanupQueue(provider.sender(), {
            limit: 150
        });

        console.log(`Unlocking wallet...`);

        await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
}
