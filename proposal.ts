import { AccountMeta, Connection, PublicKey, Signer, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js"
import {SplGovernance} from "governance-idl-sdk"

export async function createProposal(
    proposalTitle: string,
    proposalDescription: string,
    splGovernance: SplGovernance,
    realmAddress: PublicKey,
    governanceAddress: PublicKey,
    signerTokenOwnerRecord: PublicKey,
    membershipToken: PublicKey,
    signer: Signer,
    payer: Signer,
    proposalSeed: PublicKey,
    innerInstruction: TransactionInstruction,
    connection: Connection
) {
    // Create new proposal instruction
    const proposalIx = await splGovernance.createProposalInstruction(
        proposalTitle,
        proposalDescription,
        {choiceType: "single", multiChoiceOptions: null},
        ["Approve"],
        true,
        realmAddress,
        governanceAddress,
        signerTokenOwnerRecord,
        membershipToken,
        signer.publicKey,
        payer.publicKey,
        proposalSeed
    )

    // Derive proposal public key
    const proposalAddress = splGovernance.pda.proposalAccount({
        governanceAccount: governanceAddress,
        governingTokenMint: membershipToken,
        proposalSeed: proposalSeed
    }).publicKey

    // Insert executable instruction inside proposal
    const insertInnerIxIx = await splGovernance.insertTransactionInstruction(
        [innerInstruction],
        0, 0, 0,
        governanceAddress,
        proposalAddress,
        signerTokenOwnerRecord,
        signer.publicKey,
        payer.publicKey
    )

    // Sign off the proposal
    const signOffProposalIx = await splGovernance.signOffProposalInstruction(
        realmAddress,
        governanceAddress,
        proposalAddress,
        signer.publicKey,
        undefined,
        signerTokenOwnerRecord
    )

    const tx = new Transaction().add(
        proposalIx,
        insertInnerIxIx,
        signOffProposalIx
    )

    const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer, signer]
    )

    console.log(`The proposal: "${proposalTitle}" is successfully created. Tx:`, sig)
}

export async function voteOnProposal(
    splGovernance: SplGovernance,
    realmAddress: PublicKey,
    governanceAddress: PublicKey,
    creatorTokenOwnerRecord: PublicKey,
    signerTokenOwnerRecord: PublicKey,
    membershipToken: PublicKey,
    signer: Signer,
    payer: Signer,
    proposalSeed: PublicKey,
    connection: Connection
) {
    // Derive proposal public key
    const proposalAddress = splGovernance.pda.proposalAccount({
        governanceAccount: governanceAddress,
        governingTokenMint: membershipToken,
        proposalSeed: proposalSeed
    }).publicKey

    // Vote on the proposal from Signer's wallet
    const voteIx = await splGovernance.castVoteInstruction(
        {approve: [[{rank: 0, weightPercentage: 100}]]},
        realmAddress,
        governanceAddress,
        proposalAddress,
        creatorTokenOwnerRecord,
        signerTokenOwnerRecord,
        signer.publicKey,
        membershipToken,
        payer.publicKey
    )

    const voteTx = new Transaction().add(voteIx)

    const sig = await sendAndConfirmTransaction(
        connection,
        voteTx,
        [payer, signer]
    )

    console.log(`The vote has been successfully casted by ${signer.publicKey.toBase58()}. Tx:`, sig)
}

export async function signAndExecuteProposal(
    splGovernance: SplGovernance,
    governanceAddress: PublicKey,
    membershipToken: PublicKey,
    proposalSeed: PublicKey,
    innerIx: TransactionInstruction,
    signers: Signer[],
    signerIndexes: number[], // The index of signer keys (to be turned false for CPI call)
    connection: Connection,
) {
    // Derive proposal public key
    const proposalAddress = splGovernance.pda.proposalAccount({
        governanceAccount: governanceAddress,
        governingTokenMint: membershipToken,
        proposalSeed: proposalSeed
    }).publicKey

    // Derive proposal transaction account address required in the execute tx
    const proposalTransactionAccount = splGovernance.pda.proposalTransactionAccount({
        proposal: proposalAddress,
        optionIndex: 0,
        index: 0
    }).publicKey

    const keys: AccountMeta[] = [
        {pubkey: innerIx.programId, isSigner: false, isWritable: false}, // the first key is the program id
        ...innerIx.keys
    ]

    for (const signerIx of signerIndexes) {
        keys[signerIx+1].isSigner = false
    }

    // Execute the proposal
    const executeProposalIx = await splGovernance.executeTransactionInstruction(
        governanceAddress,
        proposalAddress,
        proposalTransactionAccount,
        keys
    )
        
    await new Promise(resolve => setTimeout(resolve, 2000)) // add 2 sec delay before execution 

    const executeTx = new Transaction().add(executeProposalIx)

    const sig = await sendAndConfirmTransaction(
        connection,
        executeTx,
        signers
    )

    console.log(`The proposal is successfully executed. Tx:`, sig)
}