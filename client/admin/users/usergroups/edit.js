'use strict';


var ko   = require('knockout');
var Form = require('./_form');


N.wire.on('navigate.done:' + module.apiPath, function () {
  ko.applyBindings(new Form(N.runtime.page_data), $('#content').get(0));
  $('#content form[data-bind]:first').show();
});


N.wire.on('navigate.exit:' + module.apiPath, function () {
  ko.cleanNode($('#content').get(0));
});
