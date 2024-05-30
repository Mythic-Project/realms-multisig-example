import { Connection, LAMPORTS_PER_SOL, PublicKey, Signer, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Governance } from "test-governance-sdk";


export async function createAndExecuteProposal(
    signerOne: Signer,
    signerTwo: Signer,
    governance: Governance,
    connection: Connection,
    membershipToken: PublicKey,
    multisigName: string
) {
    const realmAddress = governance.pda.realmAccount({name: multisigName}).publicKey
    const governanceAddress = governance.pda.governanceAccount({realmAccount: realmAddress, seed: realmAddress}).publicKey

    const signerOneTokenOwnerRecord = governance.pda.tokenOwnerRecordAccount({
        realmAccount: realmAddress, 
        governingTokenMintAccount: membershipToken,
        governingTokenOwner: signerOne.publicKey
    })

    const multiSigWallet = governance.pda.nativeTreasuryAccount({governanceAccount: governanceAddress}).publicKey

    const proposalSeed = realmAddress // Optional: any seed can be used to randomize proposal address, herein realmAddress used as a seed too

    // Deposit SOL to the multisig
    await depositSol(signerOne, multiSigWallet, connection)

    // Create proposal Ix
    const proposalIx = await governance.createProposalInstruction(
        "Send 0.10 SOL",
        "This proposal sends 0.10 SOL to signer two",
        {choiceType: "single", multiChoiceOptions: null},
        ["Approve"],
        true,
        realmAddress,
        governanceAddress,
        signerOneTokenOwnerRecord.publicKey,
        membershipToken,
        signerOne.publicKey,
        signerOne.publicKey,
        proposalSeed
    )

    // SOL transfer Ix from multisig wallet to signer two
    const sendSolIx = SystemProgram.transfer({
        fromPubkey: multiSigWallet,
        toPubkey: signerTwo.publicKey,
        lamports: 0.10 * LAMPORTS_PER_SOL
    })

    const proposalAddress = governance.pda.proposalAccount({
        governanceAccount: governanceAddress,
        governingTokenMint: membershipToken,
        proposalSeed: realmAddress
    }).publicKey

    // Insert SOL transfer ix in the proposal
    const insertIxIx = await governance.insertTransactionInstruction(
        [sendSolIx],
        0, 0, 0,
        governanceAddress,
        proposalAddress,
        signerOneTokenOwnerRecord.publicKey,
        signerOne.publicKey,
        signerOne.publicKey
    )

    // Sign off the proposal
    const signOffProposalIx = await governance.signOffProposalInstruction(
        realmAddress,
        governanceAddress,
        proposalAddress,
        signerOne.publicKey,
        undefined,
        signerOneTokenOwnerRecord.publicKey
    )

    // Vote on the proposal from Signer One's wallet
    const voteIx = await governance.castVoteInstruction(
        {approve: [[{rank: 0, weightPercentage: 100}]]},
        realmAddress,
        governanceAddress,
        proposalAddress,
        signerOneTokenOwnerRecord.publicKey,
        signerOneTokenOwnerRecord.publicKey,
        signerOne.publicKey,
        membershipToken,
        signerOne.publicKey
    )

    const proposalTransactionAccount = governance.pda.proposalTransactionAccount({
        proposal: proposalAddress,
        optionIndex: 0,
        index: 0
    }).publicKey


    const tx = new Transaction().add(proposalIx, insertIxIx, signOffProposalIx, voteIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [signerOne])

    console.log("The proposal is successfully created and voted. Tx:", sig)

    // Execute the proposal (since 49% approval achieved)
    sendSolIx.keys[0].isSigner = false

    const executeProposalIx = await governance.executeTransactionInstruction(
        governanceAddress,
        proposalAddress,
        proposalTransactionAccount,
        [{pubkey: sendSolIx.programId, isSigner: false, isWritable: false}, ...sendSolIx.keys]
    )

    await new Promise(resolve => setTimeout(resolve, 1000)) // add 1 sec delay before executing tx

    const executeTx = new Transaction().add(executeProposalIx)
    const executeSig = await sendAndConfirmTransaction(connection, executeTx, [signerOne])

    console.log("0.10 SOL is successfully withdrawn from the multisig wallet. Tx:", executeSig)
}

// Helper function
async function depositSol(signerOne: Signer, multiSigWallet: PublicKey, connection: Connection) {
    const depositSolIx = SystemProgram.transfer({
        fromPubkey: signerOne.publicKey,
        toPubkey: multiSigWallet,
        lamports: 0.15 * LAMPORTS_PER_SOL // 0.10 SOL deposited to the multisig
    })

    const tx = new Transaction().add(depositSolIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [signerOne])
    console.log("0.15 SOL deposited in the multi-sig wallet. Tx:", sig)
}