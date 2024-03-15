import { SendMode, internal, toNano } from '@ton/core';
import { HighloadV2R2 } from '../wrappers/HighloadV2R2';
import { compile, NetworkProvider } from '@ton/blueprint';
import { keyPairFromSeed, mnemonicToWalletKey } from '@ton/crypto';
import { LiteClient, LiteEngine, LiteRoundRobinEngine, LiteSingleEngine } from 'ton-lite-client';

export async function run(provider: NetworkProvider) {
    const engines: LiteEngine[] = [];
    for (const server of servers) {
        engines.push(new LiteSingleEngine({
            host: `tcp://${intToIP(server.ip)}:${server.port}`,
            publicKey: Buffer.from(server.id.key, 'base64'),
        }));
    }
    const engine: LiteEngine = new LiteRoundRobinEngine(engines);
    const client = new LiteClient({ engine });

    const ui = provider.ui()
    const messagesCountString = await ui.input('Messages count')
    const messagesCount = parseInt(messagesCountString, 10)
    if (messagesCount < 1) {
        throw new Error('Unknown messages count')
    }

    const mnemonic = await ui.input('Mnemonic')
    const keyPair = await mnemonicToWalletKey(mnemonic.split(','))

    const highloadV2R2 = client.open(
        HighloadV2R2.createFromConfig(
            {
               publicKey: keyPair.publicKey
            },
            await compile('HighloadV2R2')
        )
    );

    // await highloadV2R2.sendDeploy(provider.sender(), toNano('0.05'));
    //
    // await provider.waitForDeploy(highloadV2R2.address);

    for (let i = 0; i < messagesCount; i++) {
        highloadV2R2.sendTransfer({
            secretKey: keyPair.secretKey,
            messages: [internal({
                to: highloadV2R2.address,
                value: 1n
            })],
            seqno: i,
            sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
        }).then(() => {
            console.log(`Message ${i} sent`)
        }).catch((e) => {
            console.error(`Error sending message ${i}: ${e}`)
        });
    }

    await (new Promise((resolve) => setTimeout(resolve, 10_000)));
}

function intToIP(int: number) {
    var part1 = int & 255;
    var part2 = ((int >> 8) & 255);
    var part3 = ((int >> 16) & 255);
    var part4 = ((int >> 24) & 255);

    return part4 + "." + part3 + "." + part2 + "." + part1;
}

const servers = [
    {
        "ip": 1592601963,
        "port": 13833,
        "id": {
            "@type": "pub.ed25519",
            "key": "QpVqQiv1u3nCHuBR3cg3fT6NqaFLlnLGbEgtBRukDpU="
        }
    },
    {
        "ip": 1097649206,
        "port": 29296,
        "id": {
            "@type": "pub.ed25519",
            "key": "p2tSiaeSqX978BxE5zLxuTQM06WVDErf5/15QToxMYA="
        }
    },
    {
        "ip": 1162057690,
        "port": 35939,
        "id": {
            "@type": "pub.ed25519",
            "key": "97y55AkdzXWyyVuOAn+WX6p66XTNs2hEGG0jFUOkCIo="
        }
    },
    {
        "ip": -1304477830,
        "port": 20700,
        "id": {
            "@type": "pub.ed25519",
            "key": "dGLlRRai3K9FGkI0dhABmFHMv+92QEVrvmTrFf5fbqA="
        }
    },
    {
        "ip": 1959453117,
        "port": 20700,
        "id": {
            "@type": "pub.ed25519",
            "key": "24RL7iVI20qcG+j//URfd/XFeEG9qtezW2wqaYQgVKw="
        }
    },
    {
        "ip": -809760973,
        "port": 20700,
        "id": {
            "@type": "pub.ed25519",
            "key": "vunMV7K35yPlTQPx/Fqk6s+4/h5lpcbP+ao0Cy3M2hw="
        }
    },
    {
        "ip": -1177439932,
        "port": 4695,
        "id": {
            "@type": "pub.ed25519",
            "key": "cZpMFqy6n0Lsu8x/z2Jq0wh/OdM1WAVJJKSb2CvDECQ="
        }
    },
    {
        "ip": -809760945,
        "port": 41718,
        "id": {
            "@type": "pub.ed25519",
            "key": "jA1X1pNB+ihJ4tziHTD8KxKWdQESRXjDb79TgvFFOZg="
        }
    },
    {
        "ip": 1162057633,
        "port": 59672,
        "id": {
            "@type": "pub.ed25519",
            "key": "WqVn3UcFKCLaGCVp1FOZ09duh13tRqUR+rTaA9Q9sW0="
        }
    },
    {
        "ip": -2018162320,
        "port": 49760,
        "id": {
            "@type": "pub.ed25519",
            "key": "1runGS/h6Pel2LRC46suIEKaOtAYWaDGA+cXeI4HXGo="
        }
    },
    {
        "ip": -2018162357,
        "port": 47938,
        "id": {
            "@type": "pub.ed25519",
            "key": "tmnh97x53cR/oejeISkTxkTyWznvIwUQrd2nZFpkbWE="
        }
    },
    {
        "ip": 1091914382,
        "port": 21335,
        "id": {
            "@type": "pub.ed25519",
            "key": "O8PmvAwKM7n5JAQaW+q8NWKiip89eh1u9FuJZWrGvgs="
        }
    },
    {
        "ip": 1091914380,
        "port": 46427,
        "id": {
            "@type": "pub.ed25519",
            "key": "JhXt7H1dZTgxQTIyGiYV4f9VUARuDxFl/1kVBjLSMB8="
        }
    },
    {
        "ip": 1097633201,
        "port": 17439,
        "id": {
            "@type": "pub.ed25519",
            "key": "0MIADpLH4VQn+INHfm0FxGiuZZAA8JfTujRqQugkkA8="
        }
    },
    {
        "ip": 1091956407,
        "port": 16351,
        "id": {
            "@type": "pub.ed25519",
            "key": "Mf/JGvcWAvcrN3oheze8RF/ps6p7oL6ifrIzFmGQFQ8="
        }
    },
    {
        "ip": -1185526389,
        "port": 64842,
        "id": {
            "@type": "pub.ed25519",
            "key": "cmpsvK5tBuW029x0WnLHV4NAzf5F0wxEagtbODtRvjI="
        }
    },
    {
        "ip": -1185526601,
        "port": 11087,
        "id": {
            "@type": "pub.ed25519",
            "key": "NeOgnMj1Z3xvy9Tq2yAbnGf7HrSMeNNr+ba4WY3Gs+E="
        }
    }
]
