import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { Governance } from "test-governance-sdk";
import { createMultisig } from "./multisig";
import { createAndExecuteProposal } from "./proposal";
import { airdrop } from "./airdrop";
import { addAndRemoveMembers } from "./member";


const connection = new Connection(
    clusterApiUrl("devnet"),
    {commitment:"confirmed"}
);
const governance = new Governance(connection);

// Signers
const signerOne = Keypair.generate();
const signerTwo = Keypair.generate();
const signerThree = Keypair.generate();

(async() => {
    await airdrop(signerOne, connection)
    await airdrop(signerThree, connection)
       
    const multiSigName = `My Multi-sig Wallet ${Math.floor(Math.random()*10000)}` // name must be unique 
    
    const membershipToken = await createMultisig(
        signerOne, 
        signerTwo, 
        governance, 
        connection, 
        multiSigName
    ) // multsig.ts
    
    await createAndExecuteProposal(
        signerOne, 
        signerTwo, 
        governance, 
        connection, 
        membershipToken, 
        multiSigName
    ) // proposal.ts

    await addAndRemoveMembers(
        connection,
        governance,
        membershipToken,
        multiSigName,
        signerOne,
        signerTwo,
        signerThree
    ) // members.ts
})()