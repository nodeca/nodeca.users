'use strict';


const _  = require('lodash');

let form;


function Setting(field) {
  const ko = require('knockout');

  var self = this;
  var tHelp = 'users.settings.about.' + field.name + '__help';

  this.settingName = field.name;
  this.hasError    = ko.observable(false);
  this.readonly    = ko.observable(field.readonly);
  this.help        = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';
  this._value      = field.value;
  this.value       = ko.observable(this._value);
  this._mandatory  = field.mandatory;

  this.modified = ko.computed(function () {
    // assume '' is equal to null
    return (self._value || '') !== (self.value() || '');
  });

  // show asterisk on mandatory fields if field is empty when page loads
  this.must_fill = ko.computed(function () {
    return !self._value && self._mandatory;
  });
}


function Form(page_data) {
  const ko = require('knockout');

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
    self.isDirty(false);
    self.isSubmitting(false);

    N.wire.emit('notify.info', t('saved'));

    Object.keys(self.about).forEach(function (name) {
      if (res.fields[name]) {
        self.about[name].value(res.fields[name].value);
        self.about[name]._value = self.about[name].value();
        self.about[name].readonly(res.fields[name].readonly);
      }
      self.about[name].hasError(false);
    });
  }).catch(err => {
    self.isSubmitting(false);

    // Non client error will be processed with default error handler
    if (err.code !== N.io.CLIENT_ERROR) return N.wire.emit('error', err);

    // Update classes and messages on all input fields.
    Object.keys(self.about).forEach(function (name) {
      self.about[name].hasError(_.has(err.data, name));
    });
  });
};


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  form = new Form(N.runtime.page_data);
  ko.applyBindings(form, $('#user-settings-about').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
  const ko = require('knockout');

  ko.cleanNode($('#user-settings-about').get(0));
  form = null;
});


N.wire.on(module.apiPath + ':location_edit', function location_edit(data) {
  let confirm = form.isDirty() ?
                N.wire.emit('common.blocks.confirm', t('leave_confirmation')) :
                Promise.resolve();

  return confirm.then(() => N.wire.emit('navigate.to', data.$this.attr('href')));
});
