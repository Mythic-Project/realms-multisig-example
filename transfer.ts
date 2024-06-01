import { 
    Connection, 
    LAMPORTS_PER_SOL, 
    PublicKey, 
    Signer, 
    SystemProgram, 
    Transaction, 
    sendAndConfirmTransaction 
} from "@solana/web3.js";

export async function depositSol(
    payer: Signer, 
    multiSigWallet: PublicKey, 
    connection: Connection
) {
    const depositSolIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: multiSigWallet,
        lamports: 0.15 * LAMPORTS_PER_SOL // 0.15 SOL deposited to the multisig
    })

    const tx = new Transaction().add(depositSolIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [payer])
    console.log("0.15 SOL deposited in the multi-sig wallet. Tx:", sig)
}

export function transferSolIx(
    multiSigWallet: PublicKey,
    payer: PublicKey
) {
    return SystemProgram.transfer({
        fromPubkey: multiSigWallet,
        toPubkey: payer,
        lamports: 0.10 * LAMPORTS_PER_SOL
    })
}