'use strict';


function Setting(name, schema, value) {
  const ko = require('knockout');

  var tHelp = 'users.setting_names.' + name + '__help';

  this.settingName = name;
  this.priority = schema.priority;
  this.name = N.runtime.t('users.setting_names.' + name);
  this.help = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : '';
  this.type = schema.type;
  this.min = schema.min;
  this.max = schema.max;

  this._value = value ?? schema.default;

  this.value = ko.observable(this._value);

  this.valueOptions = (schema.values || []).map(option => {
    let titlePath = `@users.setting_values.${name}.${option.name}`;

    return {
      name: option.name,
      value: option.value,
      title: t.exists(titlePath) ? t(titlePath) : option.name
    };
  });

  this.modified = ko.computed(() => {
    return this._value !== this.value();
  });
}


function Form(page_data) {
  const ko = require('knockout');

  let categoryName, categorySettings, setting;

  this.categories = [];
  this.settings = [];
  this.isDirty = ko.observable(false);

  let checkDirty = () => {
    for (let setting of this.settings) {
      if (setting.modified()) {
        this.isDirty(true);
        return;
      }
    }

    this.isDirty(false);
  };

  // Grouping settings by category and priority
  for (let category of new Set(Object.values(page_data.setting_schemas).map(x => x.category_key)).values()) {

    categoryName = N.runtime.t('users.setting_cat.' + category);
    categorySettings = [];

    for (let [ key, value ] of Object.entries(page_data.setting_schemas)) {
      // Get all settings in category
      if (value.category_key === category) {
        // Add setting to category
        setting = new Setting(key, value, page_data.settings[key] ? page_data.settings[key].value : null);
        setting.value.subscribe(checkDirty);

        categorySettings.push(setting);
        this.settings.push(setting);
      }
    }

    categorySettings = categorySettings.sort((a, b) => a.priority - b.priority);

    this.categories.push({ name: categoryName, settings: categorySettings });
  }
}


Form.prototype.submit = function submit() {
  let data = { settings: {} };

  this.settings.forEach(setting => {
    if (setting.type === 'number') {
      data.settings[setting.settingName] = Number(setting.value());
    } else {
      data.settings[setting.settingName] = setting.value();
    }
  });

  N.io.rpc('users.settings.general.update', data).then(() => {
    N.wire.emit('notify.info', t('saved'));

    this.settings.forEach(setting => {
      setting._value = setting.value();
    });
    this.isDirty(false);

    // announce setting change to all tabs
    this.settings.forEach(setting => {
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
