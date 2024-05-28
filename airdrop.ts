import { Connection, LAMPORTS_PER_SOL, Signer } from "@solana/web3.js";

export async function airdrop(signer:Signer, connection: Connection) {
    const airdropSig = await connection.requestAirdrop(signer.publicKey, LAMPORTS_PER_SOL)

    const getblockhash = await connection.getLatestBlockhash("confirmed")

    await connection.confirmTransaction({
        blockhash: getblockhash.blockhash,
        lastValidBlockHeight: getblockhash.lastValidBlockHeight,
        signature: airdropSig
    }, "confirmed")

    console.log("The airdrop has been made successfully. Tx:", airdropSig)
}