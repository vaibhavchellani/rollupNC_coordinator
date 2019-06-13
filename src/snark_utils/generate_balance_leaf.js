const mimcjs = require("../../circomlib/src/mimc7.js");
const bigInt = require("snarkjs").bigInt;
const eddsa = require("../../circomlib/src/eddsa.js");

module.exports = {

    getZeroLeaf: function () {
        var zeroLeaf = {};
        zeroLeaf['pubKey_x'] = bigInt("0".padStart(76, '0'));
        zeroLeaf['pubKey_y'] = bigInt("0".padStart(77, '0'));
        zeroLeaf['balance'] = 0;
        zeroLeaf['nonce'] = 0;
        zeroLeaf['token_type'] = 0;
        return zeroLeaf;
    },

    isZeroLeaf: function (balanceLeaf) {
        var zeroLeaf = module.exports.getZeroLeaf()
        if (
            zeroLeaf['pubKey_x'] == balanceLeaf['pubKey_x'] &&
            zeroLeaf['pubKey_y'] == balanceLeaf['pubKey_y'] &&
            zeroLeaf['balance'] == balanceLeaf['balance'] &&
            zeroLeaf['nonce'] == balanceLeaf['nonce'] &&
            zeroLeaf['token_type'] == balanceLeaf['token_type']
        ) return true
    },

    generateBalanceLeafArray: function (accts_x, accts_y, token_types, balances, nonces) {
        if (Array.isArray(accts_x)) {
            var balanceLeafArray = [];
            for (var i = 0; i < accts_x.length; i++) {
                var leaf = {}
                leaf['pubKey_x'] = accts_x[i];
                leaf['pubKey_y'] = accts_y[i];
                leaf['balance'] = balances[i];
                leaf['nonce'] = nonces[i];
                leaf['token_type'] = token_types[i];
                balanceLeafArray.push(leaf);
            }
            return balanceLeafArray;
        } else {
            console.log('please enter values as arrays.')
        }
    },

    hashBalanceLeafArray: function (leafArray) {
        if (Array.isArray(leafArray)) {
            var balanceLeafHashArray = [];
            for (var i = 0; i < leafArray.length; i++) {
                var leafHash = mimcjs.multiHash([
                    leafArray[i]['pubKey_x'].toString(),
                    leafArray[i]['pubKey_y'].toString(),
                    leafArray[i]['balance'].toString(),
                    leafArray[i]['nonce'].toString(),
                    leafArray[i]['token_type'].toString()
                ])
                balanceLeafHashArray.push(leafHash)
            }
            return balanceLeafHashArray
        } else {
            console.log('please enter values as arrays.')
        }
    }
}

