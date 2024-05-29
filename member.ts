import { createAssociatedTokenAccountInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Signer, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Governance } from "test-governance-sdk";


export async function addAndRemoveMembers(
    connection: Connection,
    governance: Governance,
    membershipToken: PublicKey,
    multisigName: string,
    signerOne: Signer,
    signerTwo: Signer,
    signerThree: Signer
) {
    const realmAddress = governance.pda.realmAccount({name: multisigName}).publicKey
    const governanceAddress = governance.pda.governanceAccount({realmAccount: realmAddress, seed: realmAddress}).publicKey
    const multiSigWallet = governance.pda.nativeTreasuryAccount({governanceAccount: governanceAddress}).publicKey

    const signerOneTokenOwnerRecord = governance.pda.tokenOwnerRecordAccount({
        realmAccount: realmAddress, 
        governingTokenMintAccount: membershipToken,
        governingTokenOwner: signerOne.publicKey
    })

    const signerTwoTokenOwnerRecord = governance.pda.tokenOwnerRecordAccount({
        realmAccount: realmAddress, 
        governingTokenMintAccount: membershipToken,
        governingTokenOwner: signerTwo.publicKey
    })

    const proposalSeed = Keypair.generate().publicKey // random seed

    const addRemoveMemberProposalIx = await governance.createProposalInstruction(
        "And and Remove Signers",
        "This proposal removes Signer Two and adds Signer Three",
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

    const removeSignerIx = await governance.revokeGoverningTokensInstruction(
        1,
        realmAddress,
        signerTwoTokenOwnerRecord.publicKey,
        membershipToken,
        multiSigWallet
    )

    const signerThreeAta = getAssociatedTokenAddressSync(membershipToken, signerThree.publicKey)

    const addNewSignerIx = await governance.depositGoverningTokensInstruction(
        realmAddress,
        membershipToken,
        membershipToken,
        signerThree.publicKey,
        multiSigWallet,
        signerOne.publicKey,
        1
    )

    const proposalAddress = governance.pda.proposalAccount({
        governanceAccount: governanceAddress,
        governingTokenMint: membershipToken,
        proposalSeed
    }).publicKey

    // Insert remove member ix and add member ix in the proposal
    const insertIxIx = await governance.insertTransactionInstruction(
        [removeSignerIx],
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

    const tx = new Transaction().add(addRemoveMemberProposalIx)
    const sig = await sendAndConfirmTransaction(connection, tx, [signerOne])

    console.log("The proposal is successfully created. Tx:", sig)

    const tx2 = new Transaction().add(insertIxIx, signOffProposalIx, voteIx)
    const sig2 = await sendAndConfirmTransaction(connection, tx2, [signerOne])

    console.log("The proposal is successfully voted. Tx:", sig2)

    // Execute the proposal (since 49% approval achieved)
    const executeProposalIx = await governance.executeTransactionInstruction(
        governanceAddress,
        proposalAddress,
        proposalTransactionAccount,
        [{pubkey: removeSignerIx.programId, isSigner: false, isWritable: false}, ...removeSignerIx.keys]
    )

    await new Promise(resolve => setTimeout(resolve, 2000)) // add 1 sec delay before executing tx

    console.log(executeProposalIx.keys)
    console.log(executeProposalIx.keys.map(k => k.pubkey.toBase58()))
    
    const executeTx = new Transaction().add(executeProposalIx)
    const executeSig = await sendAndConfirmTransaction(connection, executeTx, [signerOne])

    console.log("Successfully added and removed signers. Tx:", executeSig)
}   

// Helper functions
function getKeysForExecuteIx(ix: TransactionInstruction) {
    const returnIx = {...ix}
    returnIx.keys = returnIx.keys.map(key => ({...key, isSigner: false}))
    return [{pubkey: returnIx.programId, isSigner: false, isWritable: false}, ...returnIx.keys]
}