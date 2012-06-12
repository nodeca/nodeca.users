"use strict";


// nodeca
var NLib = require('nlib');

module.exports = NLib.Application.create({
  root: __dirname,
  name: 'nodeca.users',
  bootstrap: function (nodeca, callback) {
    // empty bootstrap... for now..
    callback();
  }
});
