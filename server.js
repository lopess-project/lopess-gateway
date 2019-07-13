/*
*** Setting up hlf client constants
*/

'use strict';
var fs = require('fs');

const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const path = require('path');
const MSG_IDENTIFIER = 'msg';
const SIG_IDENTIFIER = 'sig';

const walletPath = path.join(process.cwd(), 'wallet');
const wallet = new FileSystemWallet(walletPath);

const cert = fs.readFileSync(path.join(walletPath, 'User1@org1.example.com/User1@org1.example.com-cert.pem')).toString();
const key = fs.readFileSync(path.join(walletPath, 'User1@org1.example.com/67c1373bd5ce985b724bddeba67feba261f17432d488ffbbf18134b8e8669d85_sk')).toString();

const identityLabel = 'User1@org1.example.com';
const identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);

const ccpPath = path.resolve(__dirname, 'connectionProfiles', 'connection-org1.json');

/*
*** Setting up express app to handle json data
*/
var express = require('express');
var app = express();

app.use(express.json());

/*
*** Start server and listen for JSON requests in order to parse and forward them accordingly
*/
app.post('/', function (request, response) {
    console.log("New Measurement received: %s %s", request.body[MSG_IDENTIFIER], request.body[SIG_IDENTIFIER]);

    submitTransaction(request);
    
    response.sendStatus(200); // echo the result back
});

app.listen(3000, '0.0.0.0', function() {  
    console.log('Server started. Listening on port 3000.');
    console.log('Wallet Path is: %s', walletPath);
    console.log('CCP Path is: %s', ccpPath);
});

async function submitTransaction(request) {
    try {
        await wallet.import(identityLabel, identity);

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'User1@org1.example.com', discovery: { enabled: true, asLocalhost: false} });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('scka-channel');

        // Get the contract from the network.
        const contract = network.getContract('mycc');
        
        console.log("Try to submit transaction...");

        // Submit the specified transaction.
        await contract.submitTransaction('registerMeasurement', request.body[MSG_IDENTIFIER], request.body[SIG_IDENTIFIER]);
        console.log('Transaction has been submitted');

        // Disconnect from the gateway.
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
}
