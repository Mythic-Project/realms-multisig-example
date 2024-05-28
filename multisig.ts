import { Connection, Signer, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Governance, GovernanceConfig } from "test-governance-sdk";
import { createMint, mintTo } from "@solana/spl-token";


export async function createMultisig(
    signerOne: Signer,
    signerTwo: Signer,
    governance: Governance,
    connection: Connection
) {
    // Create a new token (to be used for multisig membership)
    const membershipToken = await createToken(signerOne, connection)

    // Mint 1-1 tokens to both signers
    await mintToken(signerOne.publicKey, membershipToken, signerOne, connection)
    await mintToken(signerTwo.publicKey, membershipToken, signerOne, connection)

    // Initiate a new Realm (as a multi-sig)
    const multiSigName = "My Multi-sig Wallet" // name must be unique

    const createMultsigIx = await governance.createRealmInstruction(
        multiSigName,
        membershipToken,
        1,
        signerOne.publicKey,
        undefined,
        membershipToken,
        "dormant",
        "liquid"
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
        councilVoteTipping: {strict: {}},
        communityVetoVoteThreshold: {disabled: {}},
        votingCoolOffTime: 0,
        depositExemptProposalCount: 15
    }

    const realmAddress = governance.pda.realmAccount({name: multiSigName}).publicKey
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

    const tx = new Transaction().add(createMultsigIx, createGovIx, createTreasuryIx)
    const txSignature = await sendAndConfirmTransaction(connection, tx, [signerOne])

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

async function mintToken(receiver: PublicKey, token: PublicKey, signer: Signer, connection: Connection) {
    setTimeout(async() => {
        const sig = await mintTo(
            connection,
            signer,
            token,
            receiver,
            signer.publicKey,
            1
        )
    
        const getblockhash = await connection.getLatestBlockhash("confirmed")
        await connection.confirmTransaction({
            blockhash: getblockhash.blockhash,
            lastValidBlockHeight: getblockhash.lastValidBlockHeight,
            signature: sig
        }, "confirmed"
        )
    }, 3000)

    console.log(`1 token is minted to ${receiver.toBase58()}`)
}