import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { SplGovernance } from "governance-idl-sdk";
import { createMultisig } from "./multisig";
import { depositSol, transferSolIx } from "./transfer";
import { airdrop } from "./airdrop";
import { addSubsequentMember, removeMember } from "./member";
import { createProposal, signAndExecuteProposal, voteOnProposal } from "./proposal";

// devnet cluster
//const clusterUrl = clusterApiUrl("devnet");

// local validator
const clusterUrl = "http://127.0.0.1:8899";

const connection = new Connection(clusterUrl, {
  commitment: "confirmed",
});
const splGovernance = new SplGovernance(connection);

// Signers
const payer = Keypair.generate();
const signerOne = Keypair.generate();
const signerTwo = Keypair.generate();
const signerThree = Keypair.generate();
const signerFour = Keypair.generate();

(async () => {
  await airdrop(payer, connection);
  await airdrop(signerThree, connection);
  
  const multiSigName = `My Multi-sig Wallet ${Math.floor(
    Math.random() * 10000
  )}`; // name must be unique

  const {
    membershipToken,
    realmAddress,
    governanceAddress
  } = await createMultisig(
    payer,
    signerOne,
    signerTwo,
    signerThree,
    splGovernance,
    connection,
    multiSigName
  ); // multsig.ts

  // Example 1: Transfer SOL out of the multisig

  // -- 1.1 Deposit 0.15 SOL in the multisig
  // ---- 1.1.1 Derive multi-sig wallet address
  const multiSigWallet = splGovernance.pda.nativeTreasuryAccount({
    governanceAccount: governanceAddress
  }).publicKey

  // ---- 1.1.2 Call deposit SOL transaction
  await depositSol(
    payer,
    multiSigWallet,
    connection
  )

  // -- 1.2 Transfer 0.10 SOL from multisig to payer
  // ---- 1.2.1 Create tranfer SOL instruction
  const transferSolInnerIx = transferSolIx(
    multiSigWallet,
    payer.publicKey
  )

  // ---- 1.2.2 Derive Token Owner Record of the Signer One (who will create and sign the proposal)
  const signerOneTokenOwnerRecord = splGovernance.pda.tokenOwnerRecordAccount({
    realmAccount: realmAddress,
    governingTokenMintAccount: membershipToken,
    governingTokenOwner: signerOne.publicKey
  }).publicKey

  // ---- 1.2.3 Random public key to seed the proposal (optional)
  const proposalSeed = Keypair.generate().publicKey

  // ----- 1.2.3 Create proposal to transfer SOL
  await createProposal(
    "Transfer 0.10 SOL to payer",
    "N/A",
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    proposalSeed,
    transferSolInnerIx,
    connection
  )

  // ---- 1.2.5 Vote on the proposal from Signer One's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    proposalSeed,
    connection
  ) 

  // ---- 1.2.6 Derive Token Owner Record of the Signer Two (to vote on the proposal)
  const signerTwoTokenOwnerRecord = splGovernance.pda.tokenOwnerRecordAccount({
    realmAccount: realmAddress,
    governingTokenMintAccount: membershipToken,
    governingTokenOwner: signerTwo.publicKey
  }).publicKey

  // ---- 1.2.7 Vote on the proposal from Signer Two's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerTwoTokenOwnerRecord,
    membershipToken,
    signerTwo,
    payer,
    proposalSeed,
    connection
  )

  // ---- 1.2.8 Execute the proposal
  await signAndExecuteProposal(
    splGovernance,
    governanceAddress,
    membershipToken,
    proposalSeed,
    transferSolInnerIx,
    [payer],
    [0],
    connection
  )

  // Example 2: Remove member (Signer Three) from the multisig
  // -- 2.1 Derive Token Owner record of Signer Three
  const signerThreeTokenOwnerRecord = splGovernance.pda.tokenOwnerRecordAccount({
    realmAccount: realmAddress,
    governingTokenMintAccount: membershipToken,
    governingTokenOwner: signerThree.publicKey
  }).publicKey

  // -- 2.2 Remove member instruction to pass into the proposal
  const removeMemberInnerIx = await removeMember(
    splGovernance,
    realmAddress,
    membershipToken,
    signerThreeTokenOwnerRecord,
    multiSigWallet
  )

  // -- 2.3 Random public key to seed the proposal (optional)
  const removeMemberProposalSeed = Keypair.generate().publicKey

  // -- 2.4 Remove member proposal
  await createProposal(
    "Remove Signer Three from the multisig",
    "N/A",
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    removeMemberProposalSeed,
    removeMemberInnerIx,
    connection
  )

  // ---- 2.5 Vote on the proposal from Signer One's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    removeMemberProposalSeed,
    connection
  )

  // ---- 2.6 Vote on the proposal from Signer Two's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerTwoTokenOwnerRecord,
    membershipToken,
    signerTwo,
    payer,
    removeMemberProposalSeed,
    connection
  )

  // ---- 2.7 Execute the proposal
  await signAndExecuteProposal(
    splGovernance,
    governanceAddress,
    membershipToken,
    removeMemberProposalSeed,
    removeMemberInnerIx,
    [payer],
    [4],
    connection
  )

  // Example 3: Add new member (Signer Four) to the multisig
  // -- 3.1 Add member instruction to pass into the proposal
  const addMemberInnerIx = await addSubsequentMember(
    splGovernance,
    realmAddress,
    membershipToken,
    signerFour.publicKey,
    multiSigWallet,
    payer.publicKey
  )

  // -- 3.2 Random public key to seed the proposal (optional)
  const addMemberProposalSeed = Keypair.generate().publicKey

  // -- 3.3 Add member proposal
  await createProposal(
    "Add Signer Four to the multisig",
    "N/A",
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    addMemberProposalSeed,
    addMemberInnerIx,
    connection
  )

  // ---- 3.4 Vote on the proposal from Signer One's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerOneTokenOwnerRecord,
    membershipToken,
    signerOne,
    payer,
    addMemberProposalSeed,
    connection
  )

  // ---- 3.5 Vote on the proposal from Signer Two's wallet
  await voteOnProposal(
    splGovernance,
    realmAddress,
    governanceAddress,
    signerOneTokenOwnerRecord,
    signerTwoTokenOwnerRecord,
    membershipToken,
    signerTwo,
    payer,
    addMemberProposalSeed,
    connection
  )

  // ---- 3.6 Execute the proposal
  await signAndExecuteProposal(
    splGovernance,
    governanceAddress,
    membershipToken,
    addMemberProposalSeed,
    addMemberInnerIx,
    [payer, signerFour],
    [4],
    connection
  )
})();
