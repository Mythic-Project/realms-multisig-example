import { Connection, Signer, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Governance, GovernanceConfig } from "test-governance-sdk";
import { AuthorityType, createAssociatedTokenAccountInstruction, createMint, createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync, mintTo } from "@solana/spl-token";

export async function createMultisig(
    signerOne: Signer,
    signerTwo: Signer,
    governance: Governance,
    connection: Connection,
    multisigName: string
) {
    // Create a new token (to be used for multisig membership)
    const membershipToken = await createToken(signerOne, connection)
    const placeholderToken = await createToken(signerOne, connection)

    // Initiate a new Realm (as a multi-sig)
    const createMultsigIx = await governance.createRealmInstruction(
        multisigName,
        placeholderToken, // community token (will not be used)
        1,
        signerOne.publicKey,
        undefined,
        membershipToken,
        "dormant",
        "membership"
    )
    
    // Initiate governance for the new multsig (1-of-2 multi-sig)
    const governanceConfig: GovernanceConfig = {
        communityVoteThreshold: {disabled: {}},
        minCommunityWeightToCreateProposal: 1,
        minTransactionHoldUpTime: 0,
        votingBaseTime: 86400,
        communityVoteTipping: {disabled: {}},
        councilVoteThreshold: {yesVotePercentage: [49]},
        councilVetoVoteThreshold: {disabled: {}},
        minCouncilWeightToCreateProposal: 1,
        councilVoteTipping: {early: {}},
        communityVetoVoteThreshold: {disabled: {}},
        votingCoolOffTime: 0,
        depositExemptProposalCount: 15
    }

    const realmAddress = governance.pda.realmAccount({name: multisigName}).publicKey
    const governanceSeed = realmAddress // Optional: any seed can be used to randomize governance address, herein realmAddress used as a seed too
        
    const createGovIx = await governance.createGovernanceInstruction(
        governanceConfig,
        realmAddress,
        signerOne.publicKey,
        undefined,
        signerOne.publicKey,
        governanceSeed
    )

    const governanceAddress = governance.pda.governanceAccount({realmAccount: realmAddress, seed: realmAddress}).publicKey
    
    // Initiate Treasury for the multisig
    const createTreasuryIx = await governance.createNativeTreasuryInstruction(
        governanceAddress,
        signerOne.publicKey
    )

    // Deposit Tokens in the multisig (to get the voting power)
    const depositForSignerOneIx = await governance.depositGoverningTokensInstruction(
        realmAddress,
        membershipToken,
        membershipToken,
        signerOne.publicKey,
        signerOne.publicKey,
        signerOne.publicKey,
        1
    )

    const depositForSignerTwoIx = await governance.depositGoverningTokensInstruction(
        realmAddress,
        membershipToken,
        membershipToken,
        signerTwo.publicKey,
        signerOne.publicKey,
        signerOne.publicKey,
        1
    )

    // Transfer the authority of the multisig to governance 
    const setMultisigAuthorityIx = await governance.setRealmAuthorityInstruction(
        realmAddress,
        signerOne.publicKey,
        "setChecked",
        governanceAddress
    )

    // Transfer the mint authority to multisig
    const transferMintAuthIx = createSetAuthorityInstruction(
        membershipToken,
        signerOne.publicKey,
        AuthorityType.MintTokens,
        governance.pda.nativeTreasuryAccount({governanceAccount: governanceAddress}).publicKey
    )

    const tx = new Transaction().add(
        createMultsigIx, 
        createGovIx, 
        createTreasuryIx, 
        depositForSignerOneIx, 
        depositForSignerTwoIx,
        setMultisigAuthorityIx,
        transferMintAuthIx
    )

    const txSignature = await sendAndConfirmTransaction(connection, tx, [signerOne, signerTwo])

    console.log("The multisig is successfully created. Tx: ", txSignature)

    return membershipToken
}

// Helper functions
async function createToken(signer: Signer, connection: Connection) {
    const token = await createMint(
        connection,
        signer,
        signer.publicKey,
        signer.publicKey,
        0
    )

    console.log("The token is successfully created!", token.toBase58())
    return token
}