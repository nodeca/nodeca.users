'use strict';

var randomBytes   = require('crypto').randomBytes;
var pbkdf2        = require('crypto').pbkdf2;
var iterations    = 50000;

exports.hash = function generateHash(pass, callback) {
  var salt = randomBytes(16);

  pbkdf2(new Buffer(pass), salt, iterations, 32, 'sha256', function (err, key) {
    if (err) {
      callback(err);
      return;
    }

    callback(null,  '$pbkdf2sha256' +
                    '$' + iterations +
                    '$' + salt.toString('base64') +
                    '$' + key.toString('base64'));
  });
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

  pbkdf2(new Buffer(pass), salt, itCount, keyLen, 'sha256', function (err, key) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, test === key.toString('base64'));
  });
};
