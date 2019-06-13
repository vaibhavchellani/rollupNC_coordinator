const eddsa = require("../../circomlib/src/eddsa.js");
const txLeaf = require("./generate_tx_leaf.js");
const account = require("./generate_accounts.js");
const merkle = require("./MiMCMerkle.js");
const balance = require("./generate_balance_leaf.js");
const tx = require("./generate_tx_leaf.js")
var assert = require('assert');
const {stringifyBigInts, unstringifyBigInts} = require('./stringifybigint.js')
const bigInt = require('snarkjs').bigInt

const NONCE_MAX_VALUE = 100;
var PAD_NONCE = 0;
// const ZERO_HASH = '\x00'.repeat(32);

function pad(leafArray, leafHashArray, signaturesArray, from_accts_idx, to_accts_idx, max_length){
    if (leafArray.length > max_length) {
        throw new Error(`Length of input array ${leafArray.length} is longer than max_length ${max_length}`);
    }
    const prvKey = account.coordinatorPrvKey()
    const pubKey = account.coordinatorPubKey()
    const arrayLength = leafArray.length

    for (var i = 0; i < (max_length - arrayLength); i++){
        var empty_tx = txLeaf.generateTxLeaf(
            pubKey[0], pubKey[1], pubKey[0], pubKey[1], 
            PAD_NONCE, 0, 0
        )
        var empty_tx_hash = txLeaf.hashTxLeaf(empty_tx)
        var signature = eddsa.signMiMC(prvKey, empty_tx_hash)

        leafArray.push(empty_tx)
        leafHashArray.push(empty_tx_hash)
        signaturesArray.push(signature)
        from_accts_idx.push(1)
        to_accts_idx.push(1)
        PAD_NONCE++;

    }
    return [leafArray, leafHashArray, signaturesArray, from_accts_idx, to_accts_idx]
}


module.exports = {

    processTxArray: function (
        tx_depth,
        from_x,
        from_y,
        to_x,
        to_y,
        nonces,
        balanceLeafArrayReceiver,
        from_accounts_idx,
        to_accounts_idx,
        amounts,
        tx_token_types,
        signatures,
    ) {


        var txPosArray = merkle.generateMerklePosArray(tx_depth)

        var intermediateRoots = new Array(2 ** (tx_depth + 1))

        var fromProofs = new Array(2 ** tx_depth)
        var newToProofs = new Array(2 ** tx_depth)

        var fromPosArray = new Array(2 ** tx_depth)
        var toPosArray = new Array(2 ** tx_depth)

        var nonceFromArray = new Array(2 ** tx_depth)

        var nonceToArray = new Array(2 ** tx_depth)

        var tokenBalanceFromArray = new Array(2 ** tx_depth)
        var tokenBalanceToArray = new Array(2 ** tx_depth)
        var tokenTypeFromArray = new Array(2 ** tx_depth)
        var tokenTypeToArray = new Array(2 ** tx_depth)

        const txArray = txLeaf.generateTxLeafArray(
            from_x, from_y, to_x, to_y, nonces, amounts, tx_token_types
        )
        const txLeafHashes = txLeaf.hashTxLeafArray(txArray)
        
        const [
            txArrayPadded, 
            txLeafHashesPadded, 
            signaturesPadded,
            from_accounts_idx_padded,
            to_accounts_idx_padded
        ] = pad(
                txArray, txLeafHashes, signatures, from_accounts_idx, to_accounts_idx, 2 ** tx_depth)
        
        var R8xArray = module.exports.stringifyArray(txLeaf.getSignaturesR8x(signaturesPadded))
        var R8yArray = module.exports.stringifyArray(txLeaf.getSignaturesR8y(signaturesPadded))
        var SArray = module.exports.stringifyArray(txLeaf.getSignaturesS(signaturesPadded))

        const txTree = merkle.treeFromLeafArray(txLeafHashesPadded)
        const txRoot = merkle.rootFromLeafArray(txLeafHashesPadded)
        const txProofs = merkle.generateMerkleProofArray(txTree, txLeafHashesPadded)
        var balanceLeafHashArrayReceiver = balance.hashBalanceLeafArray(balanceLeafArrayReceiver)
        var balanceTreeReceiver = merkle.treeFromLeafArray(balanceLeafHashArrayReceiver)
        const originalState = merkle.rootFromLeafArray(balanceLeafHashArrayReceiver)

        intermediateRoots[0] = originalState

        for (var k = 0; k < 2 ** tx_depth; k++) {

            nonceFromArray[k] = balanceLeafArrayReceiver[from_accounts_idx_padded[k]]['nonce']
            nonceToArray[k] = balanceLeafArrayReceiver[to_accounts_idx_padded[k]]['nonce']

            tokenBalanceFromArray[k] = balanceLeafArrayReceiver[from_accounts_idx_padded[k]]['balance']
            tokenBalanceToArray[k] = balanceLeafArrayReceiver[to_accounts_idx_padded[k]]['balance']
            tokenTypeFromArray[k] = balanceLeafArrayReceiver[from_accounts_idx_padded[k]]['token_type']
            tokenTypeToArray[k] = balanceLeafArrayReceiver[to_accounts_idx_padded[k]]['token_type']

            fromPosArray[k] = merkle.idxToBinaryPos(from_accounts_idx_padded[k], tx_depth)
            toPosArray[k] = merkle.idxToBinaryPos(to_accounts_idx_padded[k], tx_depth)

            fromProofs[k] = merkle.getProof(from_accounts_idx_padded[k], balanceTreeReceiver, balanceLeafHashArrayReceiver)
            console.log("calling processTx for index", k)
            var output = module.exports.processTx(
                k, txArrayPadded, txProofs[k], signaturesPadded[k], txRoot,
                from_accounts_idx_padded[k], to_accounts_idx_padded[k], nonces[k],
                balanceLeafArrayReceiver,
                fromProofs[k], intermediateRoots[2 * k]
            )

            intermediateRoots[2 * k + 1] = output['newRootSender'];
            intermediateRoots[2 * k + 2] = output['newRootReceiver'];
            var balanceTreeSender = output['newTreeSender'];
            balanceTreeReceiver = output['newTreeReceiver'];

            var balanceLeafArraySender = output['newLeafArraySender'];
            var balanceLeafHashArraySender = output['newLeafHashArraySender'];
            balanceLeafArrayReceiver = output['newLeafArrayReceiver'];
            balanceLeafHashArrayReceiver = output['newLeafHashArrayReceiver'];

            newToProofs[k] = output['newToProof'];
        }

        console.log('newRoot', intermediateRoots[2 ** (tx_depth + 1)])

        return {

            tx_root: txRoot.toString(),
            paths2tx_root: module.exports.stringifyArrayOfArrays(txProofs),
            paths2tx_root_pos: txPosArray,

            current_state: originalState.toString(),

            intermediate_roots: module.exports.stringifyArray(intermediateRoots.slice(0, 2 ** (tx_depth + 1))),
            paths2root_from: module.exports.stringifyArrayOfArrays(fromProofs),
            paths2root_to: module.exports.stringifyArrayOfArrays(newToProofs),
            paths2root_from_pos: fromPosArray,
            paths2root_to_pos: toPosArray,

            from_x: module.exports.stringifyArray(from_x),
            from_y: module.exports.stringifyArray(from_y),
            R8x: module.exports.stringifyArray(R8xArray),
            R8y: module.exports.stringifyArray(R8yArray),
            S: module.exports.stringifyArray(SArray),

            nonce_from: nonceFromArray.map(Number),
            to_x: module.exports.stringifyArray(to_x),
            to_y: module.exports.stringifyArray(to_y),
            nonce_to: nonceToArray.map(Number),
            amount: amounts.map(Number),

            token_balance_from: tokenBalanceFromArray.map(Number),
            token_balance_to: tokenBalanceToArray,
            token_type_from: tokenTypeFromArray.map(Number),
            token_type_to: tokenTypeToArray.map(Number)

        }

    },

    processTx: function (
        txIdx, txLeafArray, txProof, signature, txRoot,
        fromLeafIdx, toLeafIdx, nonce, balanceLeafArray,
        fromProof, oldBalanceRoot
    ) {


        // parse txLeaf
        var txDepth = txProof.length //depth of tx tree
        const txLeaf = txLeafArray[txIdx] //the transaction being processed
        var txLeafHash = tx.hashTxLeafArray([txLeaf])[0] // hash of tx being processed

        var txPos = merkle.idxToBinaryPos(txIdx, txDepth) //binary vector

        // parse balanceLeaves
        var balDepth = fromProof.length; // depth of balance tree
        const fromLeaf = balanceLeafArray[fromLeafIdx] //sender account
        var fromLeafHash = balance.hashBalanceLeafArray([fromLeaf])[0] // hash of sender acct
        const toLeaf = balanceLeafArray[toLeafIdx] //receiver account
        var toLeafHash = balance.hashBalanceLeafArray([toLeaf])[0] //hash of receiver acct
        //check tx existence
        assert(merkle.verifyProof(txLeafHash, txIdx, txProof, txRoot))

        // balance checks
        module.exports.checkBalances(txLeaf, fromLeaf, toLeaf)

        // signature checks
        module.exports.checkSignature(txLeaf, fromLeaf, signature)

        // nonce check
        module.exports.checkNonce(fromLeaf, nonce)

        // check sender existence in original root
        assert(merkle.verifyProof(fromLeafHash, fromLeafIdx, fromProof, oldBalanceRoot))

        // // check receiver existence in original root
        // assert(merkle.verifyProof(toLeafHash, toLeafIdx, toProof, oldBalanceRoot))

        // get new leaves
        let newFromLeaf
        let newToLeaf
        [newFromLeaf, newToLeaf] = module.exports.getNewLeaves(txLeaf, fromLeaf, toLeaf)

        // update sender leaf to get first intermediate root
        var newLeafArraySender = balanceLeafArray.slice(0) //clone leaf array 
        newLeafArraySender[fromLeafIdx] = newFromLeaf

        var newLeafHashArraySender = balance.hashBalanceLeafArray(newLeafArraySender)
        var newTreeSender = merkle.treeFromLeafArray(newLeafHashArraySender)
        var newRootSender = merkle.rootFromLeafArray(newLeafHashArraySender)

        // get inclusion proof for receiver leaf using first intermediate root
        var newToProof = merkle.getProof(toLeafIdx, newTreeSender, newLeafHashArraySender)

        // check receiver existence in first intermediate root
        assert(merkle.verifyProof(toLeafHash, toLeafIdx, newToProof, newRootSender))

        // update receiver leaf to get second intermediate root
        var newLeafArrayReceiver = newLeafArraySender.slice(0) //clone leaf array
        newLeafArrayReceiver[toLeafIdx] = newToLeaf
        var newLeafHashArrayReceiver = balance.hashBalanceLeafArray(newLeafArrayReceiver)
        var newTreeReceiver = merkle.treeFromLeafArray(newLeafHashArrayReceiver)
        var newRootReceiver = merkle.rootFromLeafArray(newLeafHashArrayReceiver)

        return {
            newRootSender: newRootSender, //first intermediate root after updating sender
            newRootReceiver: newRootReceiver, //second intermediate root after updating receiver
            newTreeSender: newTreeSender,
            newTreeReceiver: newTreeReceiver,
            newLeafArraySender: newLeafArraySender,
            newLeafHashArraySender: newLeafHashArraySender,
            newLeafArrayReceiver: newLeafArrayReceiver,
            newLeafHashArrayReceiver: newLeafHashArrayReceiver,
            newToProof: newToProof //inclusion proof for receiver in first intermediate root
        }
    },

    getNewLeaves: function (tx, fromLeaf, toLeaf) {

        var fromLeafCopy = balance.getZeroLeaf()
        var toLeafCopy = balance.getZeroLeaf()

        var newFromLeaf = Object.assign(fromLeafCopy, fromLeaf)
        var newToLeaf = Object.assign(toLeafCopy, toLeaf)

        newFromLeaf['balance'] = newFromLeaf['balance'] - tx['amount']
        newFromLeaf['nonce'] = parseInt(newFromLeaf['nonce']) + 1


        if (!account.isZeroAddress(toLeaf['pubKey_x'], toLeaf['pubKey_y'])) {
            newToLeaf['balance'] = parseInt(newToLeaf['balance']) + parseInt(tx['amount'])
        }
        return [newFromLeaf, newToLeaf]
    },

    checkSignature: function (tx, fromLeaf, signature) {
        if (signature.S[signature.S.length - 1] == 'n'){
            signature.S =  signature.S.slice(0, signature.S.length-1);
        }
        console.log('cannot eddsa verify',
            unstringifyBigInts(txLeaf.hashTxLeaf(tx)), 
            unstringifyBigInts(signature),
            unstringifyBigInts(
            [fromLeaf['pubKey_x'], 
            fromLeaf['pubKey_y']])
        )
        assert(
            eddsa.verifyMiMC(
                unstringifyBigInts(txLeaf.hashTxLeaf(tx)), 
                unstringifyBigInts(signature),
                unstringifyBigInts(
                [fromLeaf['pubKey_x'], 
                fromLeaf['pubKey_y']])
            )
        )
    },

    checkBalances: function (tx, fromLeaf, toLeaf) {
        assert(fromLeaf['balance'] - tx['amount'] <= fromLeaf['balance']);
        assert(toLeaf['balance'] + tx['amount'] >= toLeaf['balance']);
    },

    checkTokenTypes: function (tx, fromLeaf, toLeaf) {
        if (!balance.isZeroLeaf(toLeaf)) {
            assert(
                fromLeaf['token_type'] == toLeaf['token_type'] &&
                tx['token_type'] == toLeaf['token_type'] &&
                tx['token_type'] == fromLeaf['token_type']
            )
        }
    },

    checkNonce: function (fromLeaf, nonce) {
        assert(fromLeaf['nonce'] < NONCE_MAX_VALUE)
        assert(fromLeaf['nonce'] == nonce)
    },

    stringifyArray: function (array) {
        var stringified = new Array(array.length)
        for (var j = 0; j < array.length; j++) {
            stringified[j] = array[j].toString()
        }
        return stringified;
    },

    stringifyArrayOfArrays: function (arrayOfArrays) {
        var outerArray = new Array(arrayOfArrays.length)
        for (var i = 0; i < arrayOfArrays.length; i++) {
            outerArray[i] = module.exports.stringifyArray(arrayOfArrays[i])
        }
        return outerArray
    },

    pickByIndices: function (array, idxArray) {
        var pickedArray = new Array(idxArray.length)
        for (var i = 0; i < idxArray.length; i++) {
            pickedArray[i] = array[idxArray[i]]
        }
        return pickedArray
    }

}