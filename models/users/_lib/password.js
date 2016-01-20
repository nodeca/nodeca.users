'use strict';


const randomBytes   = require('crypto').randomBytes;
const pbkdf2        = require('crypto').pbkdf2;
const iterations    = 50000;


exports.hash = function generateHash(pass) {
  return new Promise((resolve, reject) => {
    let salt = randomBytes(16);

    pbkdf2(new Buffer(pass), salt, iterations, 32, 'sha256', function (err, key) {
      if (err) {
        reject(err);
        return;
      }

      resolve('$pbkdf2sha256' +
        '$' + iterations +
        '$' + salt.toString('base64') +
        '$' + key.toString('base64')
      );
    });
  });
};

exports.check = function checkPassword(pass, hash) {
  return new Promise((resolve, reject) => {
    if (!pass) {
      // empty password always fail
      resolve(false);
      return;
    }

    let parts = hash.split('$').slice(1);
    let itCount = parseInt(parts[1], 10),
        salt    = new Buffer(parts[2], 'base64'),
        test    = parts[3],
        keyLen  = (new Buffer(test, 'base64')).length;

    pbkdf2(new Buffer(pass), salt, itCount, keyLen, 'sha256', function (err, key) {
      if (err) {
        reject(err);
        return;
      }

      resolve(test === key.toString('base64'));
    });
  });
};
