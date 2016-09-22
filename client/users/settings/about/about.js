'use strict';


const _  = require('lodash');
const ko = require('knockout');


function Setting(field) {
  var self = this;
  var tHelp = 'users.settings.about.' + field.name + '__help';

  this.settingName = field.name;
  this.hasError    = ko.observable(false);
  this.help        = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';
  this._value      = field.value;
  this.value       = ko.observable(this._value);

  this.modified = ko.computed(function () {
    return (self._value !== self.value()) ||
           (!self._value && !self.value()); // assume '' is equal to null
  });
}


function Form(page_data) {
  let self = this;

  this.about = {};
  this.isDirty = ko.observable(false);
  this.isSubmitting = ko.observable(false);

  function checkDirty() {
    let dirty = Object.keys(self.about).reduce((acc, name) => {
      if (acc) return acc;

      if (self.about[name].modified()) {
        return true;
      }
    }, false);

    self.isDirty(dirty);
  }

  page_data.about.forEach(function (field) {
    let setting = new Setting(field);

    setting.value.subscribe(checkDirty);
    self.about[setting.settingName] = setting;
  });
}


Form.prototype.submit = function submit() {
  let self = this;

  let data = {};

  Object.keys(this.about).forEach(function (name) {
    data[name] = self.about[name].value();

    if (typeof data[name] === 'undefined') {
      data[name] = null;
    }
  });

  self.isSubmitting(true);

  N.io.rpc('users.settings.about.update', data).then(res => {
    N.wire.emit('notify', {
      type: 'info',
      message: t('saved')
    });

    Object.keys(self.about).forEach(function (name) {
      self.about[name].value(res.fields[name]);
      self.about[name]._value = self.about[name].value();
      self.about[name].hasError(false);
    });

    self.isDirty(false);
    self.isSubmitting(false);
  }).catch(err => {
    // Non client error will be processed with default error handler
    if (err.code !== N.io.CLIENT_ERROR) return N.wire.emit('error', err);

    // Update classes and messages on all input fields.
    Object.keys(self.about).forEach(function (name) {
      self.about[name].hasError(_.has(err.data, name));
    });

    self.isSubmitting(false);
  });
};


N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  ko.applyBindings(new Form(N.runtime.page_data), $('#user-settings-about').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
  ko.cleanNode($('#user-settings-about').get(0));
});
