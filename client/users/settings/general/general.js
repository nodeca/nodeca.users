'use strict';


var _  = require('lodash');


function Setting(name, schema, value) {
  const ko = require('knockout');

  var self = this;
  var tHelp = 'users.setting_names.' + name + '__help';

  this.settingName = name;
  this.priority = schema.priority;
  this.name = N.runtime.t('users.setting_names.' + name);
  this.help = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';
  this.type = schema.type;

  this._value = _.isNull(value) ? schema.default : value;

  this.value = ko.observable(this._value);

  this.valueOptions = _.map(schema.values, function (option) {
    var titlePath = '@users.setting_values.' + name + '.' + option.name;

    return {
      name: option.name,
      value: option.value,
      title: t.exists(titlePath) ? t(titlePath) : option.name
    };
  });

  this.modified = ko.computed(function () {
    return self._value !== self.value();
  });
}


function Form(page_data) {
  const ko = require('knockout');

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
  _.uniq(_.map(page_data.setting_schemas, 'category_key')).forEach(function (category) {

    categoryName = N.runtime.t('users.setting_cat.' + category);
    categorySettings = [];

    _.forEach(

      // Get all settings in category
      _.pickBy(page_data.setting_schemas, function (val) {
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

  N.io.rpc('users.settings.general.update', data).then(function () {
    N.wire.emit('notify.info', t('saved'));

    self.settings.forEach(function (setting) {
      setting._value = setting.value();
    });
    self.isDirty(false);

    // announce setting change to all tabs
    self.settings.forEach(function (setting) {
      if (setting.settingName === 'hide_heavy_content' && setting.modified()) {
        N.live.emit('local.users.settings.hide_heavy_content.change', data.settings.hide_heavy_content);
      }
    });
  }).catch(err => N.wire.emit('error', err));
};


N.wire.on('navigate.preload:' + module.apiPath, function load_deps(preload) {
  preload.push('vendor.knockout');
});


N.wire.on('navigate.done:' + module.apiPath, function page_setup() {
  const ko = require('knockout');

  ko.applyBindings(new Form(N.runtime.page_data), $('#user-settings-general').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
  const ko = require('knockout');

  ko.cleanNode($('#user-settings-general').get(0));
});
