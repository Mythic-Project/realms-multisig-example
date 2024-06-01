import { Connection, PublicKey, Signer, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { SplGovernance } from "governance-idl-sdk";

export async function addInitialMember(
    splGovernance: SplGovernance,
    realmAddress: PublicKey,
    membershipToken: PublicKey,
    signer: Signer,
    payer: Signer,
    connection: Connection
) {
    // Deposit Tokens in the multisig (to get the voting power)
    const depositForSignerIx =
        await splGovernance.depositGoverningTokensInstruction(
        realmAddress,
        membershipToken,
        membershipToken,
        signer.publicKey,
        payer.publicKey,
        payer.publicKey,
        1
    );

    const addSignerTx = new Transaction().add(depositForSignerIx);

    const addSignerSig = await sendAndConfirmTransaction(
        connection, 
        addSignerTx, [
        payer,
        signer
    ]);

    console.log(
        `Signer ${signer.publicKey.toBase58()} is added to the multisig. Tx: `,
        addSignerSig
    );
}

export async function removeMember(
    splGovernance: SplGovernance,
    realmAddress: PublicKey,
    membershipToken: PublicKey,
    tokenOwnerRecord: PublicKey,
    multiSigWallet: PublicKey,
) {
    return await splGovernance.revokeGoverningTokensInstruction(
        1,
        realmAddress,
        tokenOwnerRecord,
        membershipToken,
        multiSigWallet
    )
}

export async function addSubsequentMember(
    splGovernance: SplGovernance,
    realmAddress: PublicKey,
    membershipToken: PublicKey,
    signer: PublicKey,
    multiSigWallet: PublicKey,
    payer: PublicKey
) {
    return await splGovernance.depositGoverningTokensInstruction(
        realmAddress,
        membershipToken,
        membershipToken,
        signer,
        multiSigWallet,
        payer,
        1
    )
}