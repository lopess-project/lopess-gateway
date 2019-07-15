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

const cert = fs.readFileSync(path.join(walletPath, 'Admin1@org1.example.com/Admin@org1.example.com-cert.pem')).toString();
const key = fs.readFileSync(path.join(walletPath, 'Admin1@org1.example.com/7c9c6fa13c15e06ba15dd685ea96b53e02c4f70c809830bc023309b6328144dd_sk')).toString();

const identityLabel = 'admin';
const identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);

const ccpPath = path.resolve(__dirname, 'connectionProfiles', 'connection-org2.json');

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

app.get('/', function (request, response) {
    var recordSet = queryLedger;
    response.render("view/index.html", JSON.stringify(recordSet));
});

app.listen(3000, '0.0.0.0', function() {
    console.log('Server started. Listening on port 3000.');
    console.log('Wallet Path is: %s', walletPath);
    console.log('CCP Path is: %s', ccpPath);
});

async function queryLedger(request) {
    try {
        await wallet.import(identityLabel, identity);

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: false}, eventHandlerOptions: { commitTimeout: 500 }, clientTlsIdentity: 'Admin@org1.example.com' });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('scka-channel');

        // Get the contract from the network.
        const contract = network.getContract('mycc');

        console.log("Try to query ledger...");

        // Submit the specified transaction.
        var payload = contract.createTransaction('getMeasurementRecords').submit();
        console.log('Ledger has been queried. Results forwarded...');

        // Disconnect from the gateway.
        await gateway.disconnect();
        return payload;

    } catch (error) {
        console.error(`Failed to query ledger: ${error}`);
        return "Failed to query ledger. See log for more info"
    }
}

async function submitTransaction(request) {
    try {
        await wallet.import(identityLabel, identity);

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: false}, eventHandlerOptions: { commitTimeout: 100 }, clientTlsIdentity: 'Admin@org1.example.com' });

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
    }
}
