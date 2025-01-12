"use strict";

exports.__esModule = true;

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _enforce_types = require("./enforce_types");

var _enforce_types2 = _interopRequireDefault(_enforce_types);

var _bigi = require("bigi");

var _bigi2 = _interopRequireDefault(_bigi);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// from https://github.com/bitcoinjs/bitcoinjs-lib
var Buffer = require("safe-buffer").Buffer;

function ECSignature(r, s) {
    (0, _enforce_types2.default)(_bigi2.default, r);
    (0, _enforce_types2.default)(_bigi2.default, s);

    this.r = r;
    this.s = s;
}

// Import operations
ECSignature.parseCompact = function (buffer) {
    _assert2.default.equal(buffer.length, 65, "Invalid signature length");
    var i = buffer.readUInt8(0) - 27;

    // At most 3 bits
    _assert2.default.equal(i, i & 7, "Invalid signature parameter");
    var compressed = !!(i & 4);

    // Recovery param only
    i = i & 3;

    var r = _bigi2.default.fromBuffer(buffer.slice(1, 33));
    var s = _bigi2.default.fromBuffer(buffer.slice(33));

    return {
        compressed: compressed,
        i: i,
        signature: new ECSignature(r, s)
    };
};

ECSignature.fromDER = function (buffer) {
    _assert2.default.equal(buffer.readUInt8(0), 0x30, "Not a DER sequence");
    _assert2.default.equal(buffer.readUInt8(1), buffer.length - 2, "Invalid sequence length");
    _assert2.default.equal(buffer.readUInt8(2), 0x02, "Expected a DER integer");

    var rLen = buffer.readUInt8(3);
    (0, _assert2.default)(rLen > 0, "R length is zero");

    var offset = 4 + rLen;
    _assert2.default.equal(buffer.readUInt8(offset), 0x02, "Expected a DER integer (2)");

    var sLen = buffer.readUInt8(offset + 1);
    (0, _assert2.default)(sLen > 0, "S length is zero");

    var rB = buffer.slice(4, offset);
    var sB = buffer.slice(offset + 2);
    offset += 2 + sLen;

    if (rLen > 1 && rB.readUInt8(0) === 0x00) {
        (0, _assert2.default)(rB.readUInt8(1) & 0x80, "R value excessively padded");
    }

    if (sLen > 1 && sB.readUInt8(0) === 0x00) {
        (0, _assert2.default)(sB.readUInt8(1) & 0x80, "S value excessively padded");
    }

    _assert2.default.equal(offset, buffer.length, "Invalid DER encoding");
    var r = _bigi2.default.fromDERInteger(rB);
    var s = _bigi2.default.fromDERInteger(sB);

    (0, _assert2.default)(r.signum() >= 0, "R value is negative");
    (0, _assert2.default)(s.signum() >= 0, "S value is negative");

    return new ECSignature(r, s);
};

// FIXME: 0x00, 0x04, 0x80 are SIGHASH_* boundary constants, importing Transaction causes a circular dependency
ECSignature.parseScriptSignature = function (buffer) {
    var hashType = buffer.readUInt8(buffer.length - 1);
    var hashTypeMod = hashType & ~0x80;

    (0, _assert2.default)(hashTypeMod > 0x00 && hashTypeMod < 0x04, "Invalid hashType");

    return {
        signature: ECSignature.fromDER(buffer.slice(0, -1)),
        hashType: hashType
    };
};

// Export operations
ECSignature.prototype.toCompact = function (i, compressed) {
    if (compressed) i += 4;
    i += 27;

    var buffer = Buffer.alloc(65);
    buffer.writeUInt8(i, 0);

    this.r.toBuffer(32).copy(buffer, 1);
    this.s.toBuffer(32).copy(buffer, 33);

    return buffer;
};

ECSignature.prototype.toDER = function () {
    var rBa = this.r.toDERInteger();
    var sBa = this.s.toDERInteger();

    var sequence = [];

    // INTEGER
    sequence.push(0x02, rBa.length);
    sequence = sequence.concat(rBa);

    // INTEGER
    sequence.push(0x02, sBa.length);
    sequence = sequence.concat(sBa);

    // SEQUENCE
    sequence.unshift(0x30, sequence.length);

    return Buffer.from(sequence);
};

ECSignature.prototype.toScriptSignature = function (hashType) {
    var hashTypeBuffer = Buffer.alloc(1);
    hashTypeBuffer.writeUInt8(hashType, 0);

    return Buffer.concat([this.toDER(), hashTypeBuffer]);
};

exports.default = ECSignature;
module.exports = exports["default"];