import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { Governance } from "test-governance-sdk";
import { createMultisig } from "./multisig";
import { createAndExecuteProposal } from "./proposal";
import { airdrop } from "./airdrop";


const connection = new Connection(
    clusterApiUrl("devnet"), 
    {commitment:"confirmed"}
);
const governance = new Governance(connection);

// Signers
const signerOne = Keypair.generate();
const signerTwo = Keypair.generate();

(async() => {
    await airdrop(signerOne, connection)    
    const membershipToken = await createMultisig(signerOne, signerTwo, governance, connection) // check multsig.ts
    await createAndExecuteProposal(signerOne, signerTwo, governance, connection, membershipToken) // check proposal.ts
})()