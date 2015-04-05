'use strict';

var randomBytes   = require('crypto').randomBytes;

// TODO: change to async crypto pbkdf2-sha256 when node 0.12 released,
// and increase iterations to ~200000.
var pbkdf2   = require('pbkdf2-sha256');
var iterations = 10000;

exports.hash = function generateHash(pass, callback) {
  var salt = randomBytes(16);
  var res  = pbkdf2(new Buffer(pass), salt, iterations, 32);

  callback(null,  '$pbkdf2sha256' +
                  '$' + iterations +
                  '$' + salt.toString('base64') +
                  '$' + res.toString('base64'));
};

exports.check = function checkPassword(pass, hash, callback) {
  if (!pass) {
    // empty password always fail
    callback(null, false);
    return;
  }

  var parts = hash.split('$').slice(1);

  var itCount = parseInt(parts[1], 10),
      salt    = new Buffer(parts[2], 'base64'),
      test    = parts[3],
      keyLen  = (new Buffer(test, 'base64')).length;

  callback(null, test === pbkdf2(new Buffer(pass), salt, itCount, keyLen).toString('base64'));
};
