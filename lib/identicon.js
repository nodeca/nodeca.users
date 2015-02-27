// Create identicon data-uri based on an input string
//

'use strict';


/* eslint-disable no-bitwise */

var _ = require('lodash');


// Generate SHA-1 hash of an input string
//
// https://github.com/jbt/js-crypto
//
function sha1(str) {
  /* global unescape */
  var blockstart = 0,
      i = 0,
      W = [],
      A, B, C, D, F, G,
      H = [ A = 0x67452301, B = 0xEFCDAB89, ~A, ~B, 0xC3D2E1F0 ],
      word_array = [],
      temp2,
      s = unescape(encodeURI(str)),
      str_len = s.length;

  for (; i <= str_len;) {
    word_array[i >> 2] |= (s.charCodeAt(i) || 128) << (8 * (3 - i++ % 4));
  }
  word_array[temp2 = ((str_len + 8) >> 6 << 4) + 15] = str_len << 3;

  for (; blockstart <= temp2; blockstart += 16) {
    A = H; i = 0;

    for (; i < 80;
      A = [ [
        (
          G = ((s = A[0]) << 5 | s >>> 27) + A[4]
            + (W[i] = (i < 16) ? ~~word_array[blockstart + i] : G << 1 | G >>> 31) + 1518500249
        ) + (
          (B = A[1]) & (C = A[2]) | ~B & (D = A[3])
        ),
        F = G + (B ^ C ^ D) + 341275144,
        G + (B & C | B & D | C & D) + 882459459,
        F + 1535694389
      ][0 | ((i++) / 20)] | 0, s, B << 30 | B >>> 2, C, D ]
    ) {
      G = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
    }

    for (i = 5; i; ) {
      H[--i] = H[i] + A[i] | 0;
    }
  }

  for (str = ''; i < 40; ) {
    str += (H[i >> 3] >> (7 - i++ % 8) * 4 & 15).toString(16);
  }
  return str;
}


// Convert color from HSL to RGB model
//
// Arguments: h, s, l - color components in range 0..1
// Return value: [ r, g, b ] - color components in range 0..255
//
// https://gist.github.com/aemkei/1325937
//
function hslToRgb(h, s, l) {
  var a = h, b = s, c = l;
  a *= 6;
  b = [
    c += b *= c < 0.5 ?
              c :
              1 - c,
    c - a % 1 * b * 2,
    c -= b *= 2,
    c,
    c + a % 1 * b,
    c + b
  ];
  return [
    (b[(a | 0) % 6]  * 256) | 0, // red
    (b[(a | 16) % 6] * 256) | 0, // green
    (b[(a | 8) % 6]  * 256) | 0  // blue
  ];
}


// Pick bits from a hex string one by one
//
// Returns a function each subsequent execution of which
// returns next bit in a sequence
//
function bitGenerator(hash) {
  var hash_leading_value = 1, hash_pos = 0;

  return function() {
    var result;

    if (hash_leading_value <= 1) {
      if (hash_pos >= hash.length) {
        // End of the string reached, and user asks for more data which we don't have.
        //
        // This is not expected to happen until you have like 12x12 identicon,
        // but when it does, we can replace SHA-1 with a good PRNG
        // (e.g. Mersenne-Twister?) using input string as a seed.
        //
        throw new Error('Identicon: no more data available');
      }

      // We have 4 significant bits here, and set 1 leftmost bit
      // to 1 as an end marker, so the number looks like this:
      // 0...0001xxxx
      //
      // When this number goes to 1, we know we should retrieve more data
      //
      hash_leading_value = 0x10 + parseInt(hash[hash_pos], 16);
      hash_pos++;
    }

    result = hash_leading_value & 1;
    hash_leading_value >>= 1;
    return result;
  };
}


// Class used to create and serialize identicons
//
//  - str  - a string which identicon is based upon
//  - size - width of the generated image
//
function Identicon(str, size) {
  var fg_color,
      hash = sha1(String(str));

  // Settings
  //
  this.side_tiles = 5;   // create 5x5 grid

  // Configure color settings here
  //
  this.saturation = 0.5; // "S" component in HSL
  this.lightness  = 0.7; // "L" component in HSL
  this.bgColor    = '#f0f0f0';

  this.size = size;
  this.matrix = this.createMatrix(hash.slice(7));

  // Border size logic
  //
  var halfTiles = ((this.side_tiles + 1) * 2);
  var halfTileSize = Math.floor(size / halfTiles);
  var borderExtra = (size - (halfTiles * halfTileSize)) / 2;

  this.tileSize   = halfTileSize * 2;
  this.borderSize = halfTileSize + borderExtra;

  // Foreground color, HSL, H value is random, S and L are configurable;
  // this is different from retricon, and ensures that all colors look roughly the same
  //
  fg_color = hslToRgb(parseInt(hash.slice(0, 7), 16) / 0xfffffff, this.saturation, this.lightness);
  this.fgColor = '#' + fg_color.map(function pointToHex(x) {
    return ('0' + x.toString(16)).slice(-2);
  }).join('');

  this.svg = _.template(
      '<svg xmlns="http://www.w3.org/2000/svg" width="<%- size %>" height="<%- size %>">'
    + '<rect x="0" y="0" width="100%" height="100%" fill="<%- bg_color %>" />'
    + '<g fill="<%- fg_color %>" stroke="<%- fg_color %>" stroke-width="0.1">'
    + '<%= body %>'
    + '</g>'
    + '</svg>'
  )({
    bg_color: this.bgColor,
    fg_color: this.fgColor,
    size: size,
    body: this.drawTiles(this.matrix)
  });
}


// Generate NxN matrix (Y-symmetric).
//
Identicon.prototype.createMatrix = function createMatrix(hash) {
  var x, y, result,
      pickBit = bitGenerator(hash);

  result = [];

  for (x = 0; x < Math.ceil(this.side_tiles, 2); x++) {
    result[x] = [];

    for (y = 0; y < this.side_tiles; y++) {
      result[x][y] = pickBit();
    }
  }

  for (x = 0; x < Math.floor(this.side_tiles, 2); x++) {
    result[this.side_tiles - x - 1] = result[x];
  }

  return result;
};


// Draw tile as svg rectangle
//
Identicon.prototype.drawTiles = function(matrix) {
  var x, y,
      result = [],
      tpl = _.template('<rect x="<%- x %>" y="<%- y %>" width="<%- w %>" height="<%- h %>" />');

  for (x = 0; x < this.side_tiles; x++) {
    for (y = 0; y < this.side_tiles; y++) {
      if (matrix[x][y]) {
        result.push(tpl({
          x: x * this.tileSize + this.borderSize,
          y: y * this.tileSize + this.borderSize,
          w: this.tileSize,
          h: this.tileSize
        }));
      }
    }
  }

  return result.join('');
};


// Return data-uri
//
Identicon.prototype.toDataURI = function toDataURI() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(this.svg);
};


// Generate identicon png encoded into dataURI
//
module.exports = function identicon(str, size) {
  return new Identicon(str, size).toDataURI();
};
