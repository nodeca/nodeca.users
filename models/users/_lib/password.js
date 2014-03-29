'use strict';

var crypto   = require('crypto');

// TODO: change to crypto pbkdf2-sha256 when node 0.12 released,
// and increase iterations to ~200000.
var pbkdf2   = require('pbkdf2-sha256');
var iterations = 10000;

exports.hash = function setPassword(pass) {
  var salt = crypto.randomBytes(16);
  var hash  = pbkdf2(new Buffer(pass), salt, iterations, 32);

  return  '$pbkdf2sha256' +
          '$' + iterations +
          '$' + salt.toString('base64') +
          '$' + hash.toString('base64');
};

exports.check = function checkPassword(pass, hash) {
  if (!pass) {
    // empty password always fail
    return false;
  }

  var parts = hash.split('$');
  parts.shift();

  var itCount = parseInt(parts[1]);
  var salt = new Buffer(parts[2],'base64');
  var test = parts[3];
  var keyLen = (new Buffer(test, 'base64')).length;

  return test === pbkdf2(new Buffer(pass), salt, itCount, keyLen).toString('base64');
};