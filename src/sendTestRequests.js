import request from 'request';
import Transaction from './transaction.js';
import Poller from './poller.js';
import {prv2pub} from '../circomlib/src/eddsa';
import DB from './db'
import utils from './utils'

const url = "http://localhost:3000/submitTx";

function formatSignature(tx) {
    return {
        R8: `${tx.R1},${tx.R2}`,
        S: tx.S.toString(),
    }
}

function submitTx(from, to, nonce, amount, tokenType) {
    console.log(`${from.name} send ${to.name} ${amount} of token ${tokenType}`)
    const tx = new Transaction(
        from.X, from.Y, to.X, to.Y, nonce, amount, tokenType, 
        null, null, null)
    const [msg, signature] = tx.sign(from.privateKey)
    const json = {
        fromX: tx.fromX,
        fromY: tx.fromY,
        toX: tx.toX,
        toY: tx.toY,
        nonce: tx.nonce,
        amount: tx.amount,
        tokenType: tx.tokenType,
        signature: formatSignature(tx),
    }
    console.log('message', msg, 'signature', signature)
    console.log('checkSignature', utils.checkSignature(msg, tx.fromX, tx.fromY, signature))
    request.post({ url, json },
        function (error, response, body) {
            if (error) {
                return console.error('TX failed:', error);
            }
            console.log('Tx successful!  Server responded with:', body);
        }
    )
} 

const alice_privkey =  Buffer.from("2".padStart(64, '0'), "hex");
const alice_pubkey = prv2pub(alice_privkey)
const Alice = {
    name: 'alice',
    X: alice_pubkey[0].toString(),
    Y: alice_pubkey[1].toString(),
    privateKey: alice_privkey,
}
console.log(Alice, 'Alice')
const bob_privkey =  Buffer.from("5".padStart(64, '0'), "hex");
const bob_pubkey = prv2pub(bob_privkey)
const Bob = {
    name: 'bob',
    X: bob_pubkey[0].toString(),
    Y: bob_pubkey[1].toString(),
    privateKey: bob_privkey,
}
console.log(Bob, 'Bob')


var sender = Alice;
var receiver = Bob;
var tmp;

const poller = new Poller(1000);
poller.poll()
poller.onPoll(async () => {
    // const nonce = 0;
    var nonce = await DB.getNonce(sender.X, sender.Y)
    submitTx(sender, receiver, nonce, 500, 0)
    tmp = sender
    sender = receiver
    receiver = tmp;
    poller.poll()
})
