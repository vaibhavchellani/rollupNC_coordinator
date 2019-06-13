const eddsa = require("../../circomlib/src/eddsa.js");
const snarkjs = require("snarkjs");
const fs = require("fs");
const util = require("util");
const mimcjs = require("../../circomlib/src/mimc7.js");

const bigInt = snarkjs.bigInt;

module.exports = {

    generatePrvKeys: function (n) {
        var prvKeys = [];
        for (var i = 1; i < n + 1; i++) {
            var prvKey = Buffer.from(
                i.toString().padStart(64, '0'), "hex");
            // console.log(prvKey);
            prvKeys.push(prvKey);
        }
        return prvKeys;
    },

    generatePubKeys: function (prvKeys) {
        if (Array.isArray(prvKeys)) {
            var pubKeys = [];
            for (var i = 0; i < prvKeys.length; i++) {
                var pubKey = eddsa.prv2pub(prvKeys[i]);
                pubKeys.push(pubKey);
            }
        } else {
            console.log("please enter prvKeys as an array")
        }
        return pubKeys;
    },


    getPubKeysX: function (pubKeys) {
        if (Array.isArray(pubKeys[0])) {
            var pubKeysX = [];
            for (var i = 0; i < pubKeys.length; i++) {
                var pubKeyX = pubKeys[i][0];
                pubKeysX.push(pubKeyX);
            }
        } else {
            console.log("please enter pubKeys as an array")
        }
        return pubKeysX;
    },

    getPubKeysY: function (pubKeys) {
        if (Array.isArray(pubKeys[0])) {
            var pubKeysY = [];
            for (var i = 0; i < pubKeys.length; i++) {
                var pubKeyY = pubKeys[i][1];
                pubKeysY.push(pubKeyY);
            }
        } else {
            console.log("please enter pubKeys as an array")
        }
        return pubKeysY;
    },

    zeroAddress: function () {
        return [bigInt("0".padStart(76, '0')), bigInt("0".padStart(77, '0'))]
    },

    isZeroAddress: function (x, y) {
        let zeroAddress = module.exports.zeroAddress();
        return (x == zeroAddress[0] && y == zeroAddress[1])
    },

    coordinatorPrvKey: function(){
        return Buffer.from('1'.toString().padStart(64,'0'), "hex");
    },

    coordinatorPubKey: function(){
        const prvKey = module.exports.coordinatorPrvKey()
        return module.exports.generatePubKeys([prvKey])[0]
    }


}
