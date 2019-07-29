/*
*** Setting up hlf client constants
*/

'use strict';
var fs = require('fs');

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const path = require('path');
const MSG_IDENTIFIER = 'msg';
const SIG_IDENTIFIER = 'sig';

const walletPath = path.join(process.cwd(), 'wallet');
const wallet = new FileSystemWallet(walletPath);

const ccpPath = path.resolve(__dirname, 'connectionProfiles', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
const caTLSCACertsPath = path.resolve(__dirname, 'connectionProfiles', caInfo.tlsCACerts.path);
const caTLSCACerts = fs.readFileSync(caTLSCACertsPath);
const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

/*
*** Setting up express app to handle json data
*/
var express = require('express');
var app = express();
var moment = require('moment');
var cons = require('consolidate');

app.use(express.json());
app.engine('html', cons.mustache);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

/*
*** Start server and listen for JSON requests in order to parse and forward them accordingly
*/
app.post('/', function (request, response) {
    console.log("New Measurement received: %s %s", request.body[MSG_IDENTIFIER], request.body[SIG_IDENTIFIER]);
    fs.appendFile('records.txt', 'Msg: '+ request.body[MSG_IDENTIFIER]+' Sig: '+request.body[SIG_IDENTIFIER]+'\n', function (err) {
  	if (err) console.error("file could not be created");
  	console.log('Transaction log file updated.');
    });
    submitTransaction(request);

    response.sendStatus(200); // echo the result back
});

app.get('/', async function (request, response) {
    var result = await queryLedger(request);
    var records = {
	title: "Measurement Records",
	recordSet: result
    };
    response.render('index', records);
});


app.listen(3000, '0.0.0.0', function() {
    console.log('Server started. Listening on port 3000.');
    console.log('Wallet Path is: %s', walletPath);
    console.log('CCP Path is: %s', ccpPath);
});

async function enrollAndRegisterUser() {
    // Check to see if we've already enrolled the admin user.
    const adminExists = await wallet.exists('admin');
    if (!adminExists) {
        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import('admin', identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
    }
    const userExists = await wallet.exists('user1');
    if (!userExists) {
        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: false } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
	const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: 'user1', role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: 'user1', enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import('user1', userIdentity);
        console.log('Successfully registered and enrolled admin user "user1" and imported it into the wallet');
    }
}

async function queryLedger(request) {
    try {
	await enrollAndRegisterUser();

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'user1', discovery: { enabled: true, asLocalhost: false} });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('scka-channel');

        // Get the contract from the network.
        const contract = network.getContract('mycc');

        console.log("Try to query ledger...");

        // Submit the specified transaction.
        var payload = await contract.evaluateTransaction('getMeasurementRecords');
        console.log('Ledger has been queried. Results forwarded...');
	await gateway.disconnect();

        return payload.toString();

    } catch (error) {
        console.error(`Failed to query ledger: ${error}`);
        return "Failed to query ledger. See log for more info"
    }
}

async function submitTransaction(request) {
    try {
        // Timestamp when transaction arrived at gateway
        var time = moment();
        var time_format = time.format('YYYY-MM-DD HH:mm:ssZ');
        console.log("Timestamp is: %s", time_format);

        await enrollAndRegisterUser();

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: false} });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('scka-channel');

        // Get the contract from the network.
        const contract = network.getContract('mycc');
	

        console.log("Try to submit transaction...");

        // Submit the specified transaction.
        await contract.submitTransaction('registerMeasurement', request.body[MSG_IDENTIFIER], request.body[SIG_IDENTIFIER], time_format);
        console.log('Transaction has been submitted');
	await gateway.disconnect();

    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
    }
}
