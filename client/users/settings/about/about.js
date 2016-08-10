'use strict';


const ko = require('knockout');


function Setting(field) {
  var self = this;
  var tHelp = 'users.settings.about.' + field.name + '__help';

  this.settingName = field.name;
  this.name = N.runtime.t('users.about.' + field.name);
  this.help = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';

  this._value = field.value;

  this.value = ko.observable(this._value);

  this.modified = ko.computed(function () {
    return self._value !== self.value();
  });
}


function Form(page_data) {
  let self = this;

  this.about = [];
  this.isDirty = ko.observable(false);

  function checkDirty() {
    for (let i = 0; i < self.about.length; i++) {

      if (self.about[i].modified()) {
        self.isDirty(true);
        return;
      }
    }

    self.isDirty(false);
  }

  page_data.about.forEach(function (field) {
    let setting = new Setting(field);

    setting.value.subscribe(checkDirty);
    self.about.push(setting);
  });
}


Form.prototype.submit = function submit() {
  let self = this;

  let data = {};

  this.about.forEach(function (setting) {
    data[setting.settingName] = setting.value();

    if (typeof data[setting.settingName] === 'undefined') {
      data[setting.settingName] = null;
    }
  });

  N.io.rpc('users.settings.about.update', data).then(function () {
    N.wire.emit('notify', {
      type: 'info',
      message: t('saved')
    });

    self.about.forEach(function (setting) {
      setting._value = setting.value();
    });
    self.isDirty(false);
  }).catch(err => N.wire.emit('error', err));
};


N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  ko.applyBindings(new Form(N.runtime.page_data), $('#user-settings-about').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
  ko.cleanNode($('#user-settings-about').get(0));
});
