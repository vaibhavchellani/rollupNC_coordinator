const mimcjs = require("../../circomlib/src/mimc7.js");
const bigInt = require("snarkjs").bigInt;

module.exports = {

    getProof: function (leafIdx, tree, leaves) {
        var depth = tree.length;
        var proofIdx = module.exports.proofIdx(leafIdx, depth);
        var proof = new Array(depth);
        proof[0] = leaves[proofIdx[0]]
        for (var i = 1; i < depth; i++) {
            proof[i] = tree[depth - i][proofIdx[i]]
        }
        return proof;
    },

    verifyProof: function (leaf, idx, proof, root) {
        var computed_root = module.exports.rootFromLeafAndPath(leaf, idx, proof)
        return (root == computed_root)
    },

    rootFromLeafAndPath: function (leaf, idx, merkle_path) {
        var depth = merkle_path.length
        var merkle_path_pos = module.exports.idxToBinaryPos(idx, depth)
        var root = new Array(depth);
        var left = bigInt(leaf) - bigInt(merkle_path_pos[0]) * (bigInt(leaf) - bigInt(merkle_path[0]));
        var right = bigInt(merkle_path[0]) - bigInt(merkle_path_pos[0]) * (bigInt(merkle_path[0]) - bigInt(leaf));
        root[0] = mimcjs.multiHash([left, right]);
        var i;
        for (i = 1; i < depth; i++) {
            left = root[i - 1] - bigInt(merkle_path_pos[i]) * (root[i - 1] - bigInt(merkle_path[i]));
            right = bigInt(merkle_path[i]) - bigInt(merkle_path_pos[i]) * (bigInt(merkle_path[i]) - root[i - 1]);
            root[i] = mimcjs.multiHash([left, right]);
        }
        return root[depth - 1];
    },


    proofIdx: function (leafIdx, treeDepth) {
        var proofIdxArray = new Array(treeDepth);
        var proofPos = module.exports.idxToBinaryPos(leafIdx, treeDepth);

        if (leafIdx % 2 == 0) {
            proofIdxArray[0] = leafIdx + 1;
        } else {
            proofIdxArray[0] = leafIdx - 1;
        }

        for (var i = 1; i < treeDepth; i++) {
            if (proofPos[i] == 1) {
                proofIdxArray[i] = Math.floor(proofIdxArray[i - 1] / 2) - 1;
            } else {
                proofIdxArray[i] = Math.floor(proofIdxArray[i - 1] / 2) + 1;
            }
        }

        return (proofIdxArray)
    },

    treeFromLeafArray: function (leafArray) {
        // console.log("generating tree from leaf array")
        var depth = module.exports.getBase2Log(leafArray.length);
        var tree = Array(depth);
        tree[depth - 1] = module.exports.pairwiseHash(leafArray)

        for (var j = depth - 2; j >= 0; j--) {
            // console.log("Iteration", j)
            tree[j] = module.exports.pairwiseHash(tree[j + 1])
        }
        // console.log("final merkle tree", tree.length)

        // return treeRoot[depth-1]
        return tree
    },

    rootFromLeafArray: function (leafArray) {
        return module.exports.treeFromLeafArray(leafArray)[0][0]
    },

    pairwiseHash: function (array) {
        if (array.length % 2 == 0) {
            var arrayHash = []
            for (var i = 0; i < array.length; i = i + 2) {
                arrayHash.push(mimcjs.multiHash(
                    [array[i].toString(),
                    array[i + 1].toString()]
                    )   
                )
            }
            return arrayHash
        } else {
            console.log('array has', array.length, 'elements')
            console.log('array must have even number of elements')
        }
    },

    getBase2Log: function (y) {
        return Math.floor(Math.log(y) / Math.log(2));
    },

    generateMerklePosArray: function (depth) {
        var merklePosArray = [];
        for (var i = 0; i < 2 ** depth; i++) {
            var binPos = module.exports.idxToBinaryPos(i, depth)
            merklePosArray.push(binPos)
        }
        return merklePosArray;
    },

    generateMerkleProofArray: function (txTree, txLeafHashes) {
        var txProofs = new Array(txLeafHashes.length)
        for (var jj = 0; jj < txLeafHashes.length; jj++) {
            txProofs[jj] = module.exports.getProof(jj, txTree, txLeafHashes)
        }
        return txProofs;
    },

    binaryPosToIdx: function (binaryPos) {
        var idx = 0;
        for (var i = 0; i < binaryPos.length; i++) {
            idx = idx + binaryPos[i] * (2 ** i)
        }
        return idx;
    },

    idxToBinaryPos: function (idx, binLength) {
        var binString = idx.toString(2);
        var binPos = Array(binLength).fill(0)
        for (var j = 0; j < binString.length; j++) {
            binPos[j] = Number(binString.charAt(binString.length - j - 1));
        }
        return binPos;
    }

}
