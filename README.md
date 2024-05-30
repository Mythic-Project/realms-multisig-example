## Realms Multsig Example

To run the demo:
```
npm install
npm run test
```
---

### Working with the Governance SDK

1. Create an spl-governance instance:
```
import { Governance } from "test-governance-sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection("RPC_ENDPOINT");
const governance = new Governance(connection);
```

2. Fetching spl-governance data:
```
// Fetch all Realms accounts (v2)
const realms = await governance.getAllRealms()

// Fetch proposal from its public key
const proposalAddress = new PublicKey("4HxrP3R6A6GcUv62VHG331gwJKNhrqHKF438oRztzz2r")
const proposal = await governance.getProposalByPubkey(proposalAddress)
```

3. Creating spl-governance instructions:
```
// Create a new Realm instruction
 const createMultsigIx = await governance.createRealmInstruction(
    multisigName,
    communityToken,
    1,
    signer.publicKey,
    undefined,
    councilToken,
    "liquid",
    "membership"
)

// Deposit governing tokens instruction
const depositForSignerTwoIx = await governance.depositGoverningTokensInstruction(
    realmAddress,
    communityToken,
    depositorAta,
    depositor,
    depositor,
    depositor,
    1
)
```
4. Working with spl-governance PDAs
```
// Derive Realm Address
const realmAddress = governance.pda.realmAccount({name: multisigName}).publicKey

// Derive Governance address
const governanceAddress = governance.pda.governanceAccount({realmAccount: realmAddress, seed: governanceSeed}).publicKey
```
