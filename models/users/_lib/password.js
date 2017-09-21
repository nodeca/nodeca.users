'use strict';


const randomBytes   = require('crypto').randomBytes;
const pbkdf2        = require('util').promisify(require('crypto').pbkdf2);
const iterations    = 50000;


exports.hash = function generateHash(pass) {
  let salt = randomBytes(16);

  return pbkdf2(Buffer.from(pass), salt, iterations, 32, 'sha256')
    .then(key =>  '$pbkdf2sha256' +
                  '$' + iterations +
                  '$' + salt.toString('base64') +
                  '$' + key.toString('base64'));
};


exports.check = function checkPassword(pass, hash) {
  if (!pass) { return Promise.resolve(false); }

  let parts = hash.split('$').slice(1);
  let itCount = parseInt(parts[1], 10),
      salt    = Buffer.from(parts[2], 'base64'),
      test    = parts[3],
      keyLen  = Buffer.from(test, 'base64').length;

  return pbkdf2(Buffer.from(pass), salt, itCount, keyLen, 'sha256')
    .then(key => test === key.toString('base64'));
};
