import {
  Connection,
  Signer,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { SplGovernance, GovernanceConfig } from "governance-idl-sdk";
import {
  AuthorityType,
  createMint,
  createSetAuthorityInstruction,
} from "@solana/spl-token";

import { BN } from "bn.js";
import { addInitialMember } from "./member";

export const DISABLED_VOTER_WEIGHT = new BN("18446744073709551615");

export async function createMultisig(
  payer: Signer,
  signerOne: Signer,
  signerTwo: Signer,
  signerThree: Signer,
  splGovernance: SplGovernance,
  connection: Connection,
  multisigName: string
) {
  // Create a new token to be used for multisig membership
  const membershipToken = await createToken(payer, connection);

  // The recovery/community token will be disabled by default but can be activated
  // to provide recovery/supervisory functionality
  const recoveryToken = await createToken(payer, connection);

  // Initiate a new Realm (as a multi-sig)
  const createMultisigIx = await splGovernance.createRealmInstruction(
    multisigName,
    recoveryToken,
    DISABLED_VOTER_WEIGHT,
    payer.publicKey,
    undefined,
    membershipToken,
    "dormant",
    "membership"
  );

  // Initiate governance for the new multisig (1-of-2 multi-sig)
  const governanceConfig: GovernanceConfig = {
    communityVoteThreshold: { disabled: {} },
    minCommunityWeightToCreateProposal: DISABLED_VOTER_WEIGHT,
    minTransactionHoldUpTime: 0,
    votingBaseTime: 86400, // In seconds == 1
    communityVoteTipping: { disabled: {} },
    councilVoteThreshold: { yesVotePercentage: [60] }, // Approval quorum
    councilVetoVoteThreshold: { disabled: {} },
    minCouncilWeightToCreateProposal: 1,
    councilVoteTipping: { strict: {} },
    communityVetoVoteThreshold: { disabled: {} },
    votingCoolOffTime: 0,
    depositExemptProposalCount: 254,
  };

  const realmAddress = splGovernance.pda.realmAccount({
    name: multisigName,
  }).publicKey;
  const governanceSeed = realmAddress; // Optional: any seed can be used to randomize governance address, herein realmAddress used as a seed too

  const createGovIx = await splGovernance.createGovernanceInstruction(
    governanceConfig,
    realmAddress,
    payer.publicKey,
    undefined,
    payer.publicKey,
    governanceSeed
  );

  const governanceAddress = splGovernance.pda.governanceAccount({
    realmAccount: realmAddress,
    seed: governanceSeed,
  }).publicKey;

  // Initiate Treasury for the multisig
  const createTreasuryIx = await splGovernance.createNativeTreasuryInstruction(
    governanceAddress,
    payer.publicKey
  );

  const createMultisigTx = new Transaction().add(
    createMultisigIx,
    createGovIx,
    createTreasuryIx,
  );

  const txSignature = await sendAndConfirmTransaction(connection, createMultisigTx, [
    payer
  ]);

  console.log("The multisig is successfully created. Tx: ", txSignature);

  // Add signers to the multisig
  await addInitialMember(
    splGovernance,
    realmAddress,
    membershipToken,
    signerOne,
    payer,
    connection
  ) // Signer One

  await addInitialMember(
    splGovernance,
    realmAddress,
    membershipToken,
    signerTwo,
    payer,
    connection
  ) // Signer Two

  await addInitialMember(
    splGovernance,
    realmAddress,
    membershipToken,
    signerThree,
    payer,
    connection
  ) // Signer Three

  // Transfer the authority of the multisig to governance
  const setMultisigAuthorityIx = await splGovernance.setRealmAuthorityInstruction(
    realmAddress,
    payer.publicKey,
    "setChecked",
    governanceAddress
  );

  // Transfer the mint authority to multisig
  const transferMintAuthIx = createSetAuthorityInstruction(
    membershipToken,
    payer.publicKey,
    AuthorityType.MintTokens,
    splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governanceAddress,
    }).publicKey
  );

  const transferAuthTx = new Transaction().add(
    transferMintAuthIx,
    setMultisigAuthorityIx
  );

  const transferTxSignature = await sendAndConfirmTransaction(connection, transferAuthTx, [
    payer
  ]);

  console.log("The authority of multisig and membership token is transferred. Tx: ", transferTxSignature);

  return {
    membershipToken,
    realmAddress,
    governanceAddress
  }
}

// Helper functions
async function createToken(signer: Signer, connection: Connection) {
  const token = await createMint(connection, signer, signer.publicKey, null, 0);

  console.log("The token is successfully created!", token.toBase58());
  return token;
}
