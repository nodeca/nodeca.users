'use strict';


const ko   = require('knockout');
const Form = require('./_form')(N);


N.wire.on('navigate.done:' + module.apiPath, function edit_usergoup_init() {
  ko.applyBindings(new Form(N.runtime.page_data), document.getElementById('content'));
  $('#content form[data-bind]:first').show();
});


N.wire.on('navigate.exit:' + module.apiPath, function edit_usergoup_free() {
  ko.cleanNode(document.getElementById('content'));
});
