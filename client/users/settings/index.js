'use strict';


var ko = require('knockout');
var _  = require('lodash');


function Setting(name, schema, value) {
  var self = this;
  var tHelp = 'users.setting_names.' + name + '__help';

  this.settingName = name;
  this.priority = schema.priority;
  this.name = N.runtime.t('users.setting_names.' + name);
  this.help = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';
  this.type = schema.type;
  this._value = value || schema.default;

  this.value = ko.observable(value || schema.default);

  this.modified = ko.computed(function() {
    return self._value !== self.value();
  });
}


function Form(page_data) {
  var self = this, categoryName, categorySettings, setting;

  this.categories = [];
  this.settings = [];
  this.isDirty = ko.observable(false);

  function checkDirty() {
    for (var i = 0; i < self.settings.length; i++) {

      if (self.settings[i].modified()) {
        self.isDirty(true);
        return;
      }
    }

    self.isDirty(false);
  }

  // Grouping settings by category and priority
  _.uniq(_.pluck(page_data.setting_schemas, 'category_key')).forEach(function (category) {

    categoryName = N.runtime.t('users.setting_cat.' + category);
    categorySettings = [];

    _.forEach(

      // Get all settings in category
      _.pick(page_data.setting_schemas, function (val) {
        return val.category_key === category;
      }),

      // Add setting to category
      function (value, key) {

        setting = new Setting(key, value, page_data.settings[key] ? page_data.settings[key].value : null);
        setting.value.subscribe(checkDirty);

        categorySettings.push(setting);
        self.settings.push(setting);
      }
    );

    categorySettings = categorySettings.sort(function (a, b) {
      return a.priority - b.priority;
    });

    self.categories.push({ name: categoryName, settings: categorySettings });
  });
}


Form.prototype.submit = function submit() {
  var self = this;

  var data = { settings: {} };

  this.settings.forEach(function (setting) {
    data.settings[setting.settingName] = setting.value();
  });

  N.io.rpc('users.settings.update', data).done(function () {
    N.wire.emit('notify', {
      type: 'info',
      message: t('saved')
    });

    self.settings.forEach(function (setting) {
      setting._value = setting.value();
    });
    self.isDirty(false);
  });
};


N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  ko.applyBindings(new Form(N.runtime.page_data), $('#user-settings').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
  ko.cleanNode($('#user-settings').get(0));
});
