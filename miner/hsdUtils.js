'use strict';

const BN = require('bn.js');
const assert = require('bsert');
const bio = require('bufio');

const BLAKE2b = require('./crypto/blake2b.js');

/*hsd/lib/protocol/consensus.js*/
exports.ZERO_HASH = Buffer.alloc(32, 0x00);
exports.NONCE_SIZE = 24;
exports.ZERO_NONCE = Buffer.alloc(exports.NONCE_SIZE, 0x00);
exports.ZERO_HASH = Buffer.alloc(32, 0x00);

/*hsd/lib/mining/common.js*/
const DIFF = 0x00000000ffff0000000000000000000000000000000000000000000000000000;
const B192 = 0x1000000000000000000000000000000000000000000000000;
const B128 = 0x100000000000000000000000000000000;
const B64 = 0x10000000000000000;
const B0 = 0x1;

/*hsd/lib/protocol/consensus.js*/
exports.toCompact = function toCompact(num) {
  if (num.isZero())
    return 0;

  let exponent = num.byteLength();
  let mantissa;

  if (exponent <= 3) {
    mantissa = num.toNumber();
    mantissa <<= 8 * (3 - exponent);
  } else {
    mantissa = num.ushrn(8 * (exponent - 3)).toNumber();
  }

  if (mantissa & 0x800000) {
    mantissa >>>= 8;
    exponent += 1;
  }

  let compact = (exponent << 24) | mantissa;

  if (num.isNeg())
    compact |= 0x800000;

  compact >>>= 0;

  return compact;
};

/*hsd/lib/protocol/consensus.js*/
exports.fromCompact = function fromCompact(compact) {
  if (compact === 0)
    return new BN(0);

  const exponent = compact >>> 24;
  const negative = (compact >>> 23) & 1;

  let mantissa = compact & 0x7fffff;
  let num;

  if (exponent <= 3) {
    mantissa >>>= 8 * (3 - exponent);
    num = new BN(mantissa);
  } else {
    num = new BN(mantissa);
    num.iushln(8 * (exponent - 3));
  }

  if (negative)
    num.ineg();

  return num;
};

/*hsd/lib/mining/common.js*/
exports.getTarget = function getTarget(bits) {
  const target = exports.fromCompact(bits);

  if (target.isNeg())
    throw new Error('Target is negative.');

  if (target.isZero())
    throw new Error('Target is zero.');

  if (target.bitLength() > 256)
    throw new Error('Target overflow.');

  return target.toArrayLike(Buffer, 'be', 32);
};
/*hsd/lib/mining/common.js*/
function double256(target) {
  let n = 0;
  let hi, lo;

  assert(target.length === 32);

  hi = target.readUInt32BE(0, true);
  lo = target.readUInt32BE(4, true);
  n += (hi * 0x100000000 + lo) * B192;

  hi = target.readUInt32BE(8, true);
  lo = target.readUInt32BE(12, true);
  n += (hi * 0x100000000 + lo) * B128;

  hi = target.readUInt32BE(16, true);
  lo = target.readUInt32BE(20, true);
  n += (hi * 0x100000000 + lo) * B64;

  hi = target.readUInt32BE(24, true);
  lo = target.readUInt32BE(28, true);
  n += (hi * 0x100000000 + lo) * B0;

  return n;
};
/*hsd/lib/mining/common.js*/
exports.getDifficulty = function getDifficulty(target) {
  const d = DIFF;
  const n = double256(target);

  if (n === 0)
    return d;

  return Math.floor(d / n);
};

/*hsd/lib/primitives/abstractblock.js*/
function maskHash(prevBlock,mask){
  return BLAKE2b.multi(prevBlock, mask);
}
/*hsd/lib/primitives/abstractblock.js*/
exports.padding = function padding(size,prevBlock,treeRoot) {
  assert((size >>> 0) === size);

  const pad = Buffer.alloc(size);

  for (let i = 0; i < size; i++)
    pad[i] = prevBlock[i % 32] ^ treeRoot[i % 32];

  return pad;
}
/*hsd/lib/primitives/abstractblock.js::toMiner*/
exports.getRawHeader = function toMiner(nonce,bt/*time,prevBlock,treeRoot,maskHash,extraNonce,reservedRoot,witnessRoot,merkleRoot,version,bits*/){
  const bw = bio.write(128 + 128);

  // Preheader.
  bw.writeU32(nonce);
  bw.writeU64(bt.time);
  bw.writeBytes(exports.padding(20,bt.prevBlock,bt.treeRoot));
  bw.writeHash(bt.prevBlock);
  bw.writeHash(bt.treeRoot);

  // Replace commitment hash with mask hash.
  bw.writeHash(maskHash(bt.prevBlock,bt.mask));

  // Subheader.
  //console.log('bt',bt);
  bw.writeBytes(bt.extraNonce);
  bw.writeHash(bt.reservedRoot);
  bw.writeHash(bt.witnessRoot);
  bw.writeHash(bt.merkleRoot);
  bw.writeU32(bt.version);
  bw.writeU32(bt.bits);

  return bw.render();
}

/*hsd/lib/primitives/abstractblock.js*/
function fromMiner(data) {
  const br = bio.read(data);
  let bt = {}
  // Preheader.
  bt.nonce = br.readU32();
  bt.time = br.readU64();

  const padding = br.readBytes(20);

  bt.prevBlock = br.readHash();
  bt.treeRoot = br.readHash();

  assert(padding.equals(exports.padding(20,bt.prevBlock,bt.treeRoot)));

  // Note: mask _hash_.
  bt._maskHash = br.readHash();

  // Subheader.
  bt.extraNonce = br.readBytes(exports.NONCE_SIZE);
  bt.reservedRoot = br.readHash();
  bt.witnessRoot = br.readHash();
  bt.merkleRoot = br.readHash();
  bt.version = br.readU32();
  bt.bits = br.readU32();

  // Mask (unknown).
  bt.mask = Buffer.alloc(32, 0x00);

  return bt;
}

/*hsd/lib/primitives/abstractblock.js*/
function toSubhead(bt) {
  const bw = bio.write(128);

  // The subheader contains miner-mutable
  // and less essential data (that is,
  // less essential for SPV resolvers).
  //console.log('extrea???',bt.extraNonce);
  bw.writeBytes(bt.extraNonce);
  bw.writeHash(bt.reservedRoot);
  bw.writeHash(bt.witnessRoot);
  bw.writeHash(bt.merkleRoot);
  bw.writeU32(bt.version);
  bw.writeU32(bt.bits);

  // Exactly one blake2b block (128 bytes).
  assert(bw.offset === BLAKE2b.blockSize);

  return bw.render();
}

/*hsd/lib/primitives/abstractblock.js*/
function subHash(bt) {
  return BLAKE2b.digest(toSubhead(bt));
}
/*hsd/lib/primitives/abstractblock.js*/
function commitHash(bt,mask) {
  // Note for mining pools: do not send
  // the mask itself to individual miners.
  return BLAKE2b.multi(subHash(bt), maskHash(bt.prevBlock,mask));
}

/*hsd/lib/primitives/abstractblock.js*/
function toPrehead(bt,mask,nonce,time) {
    const bw = bio.write(128);

    bw.writeU32(nonce);
    bw.writeU64(time);
    bw.writeBytes(exports.padding(20,bt.prevBlock,bt.treeRoot));
    bw.writeHash(bt.prevBlock);
    bw.writeHash(bt.treeRoot);
    bw.writeHash(commitHash(bt,mask));

    // Exactly one blake2b block (128 bytes).
    assert(bw.offset === BLAKE2b.blockSize);

    return bw.render();
  }

exports.getMinerHeader = function getMinerHeader(hdrRaw,mask,nonce,time){
  let bt = fromMiner(hdrRaw);
  //console.log('fromminer',bt);
  let prehead = toPrehead(bt,mask,nonce,time);
  return prehead;
}

