'use strict';


var _  = require('lodash');
var ko = require('knockout');


function Setting(form, name, schema, config) {
  this.id       = 'setting_' + name;
  this.name     = name;
  this.type     = schema.type;
  this.category = schema.category_key;
  this.priotity = schema.priority;

  this.group  = config.group;
  this.parent = ko.computed(function () {
    if (this.group && this.group.parent()) {
      return this.group.parent().settingByName[this.name];
    } else {
      return null;
    }
  }, this);

  this.localizedName = ko.computed(function () {
    return N.runtime.t('admin.setting.' + this.name);
  }, this);

  this.localizedHelp = ko.computed(function () {
    var translation = 'admin.setting.' + this.name + '_help';
    return N.runtime.t.exists(translation) ? N.runtime.t(translation) : null;
  }, this);

  this.savedOverriden = ko.observable(Boolean(config.overriden));
  this.savedValue     = ko.observable('boolean' === schema.type ? Boolean(config.value) : String(config.value));
  this.savedForced    = ko.observable(Boolean(config.forced));

  this.overriden = ko.observable(this.savedOverriden());
  this.inherited = ko.computed(function () { return !this.overriden(); }, this);
  this.value     = ko.observable(this.savedValue());
  this.forced    = ko.observable(this.savedForced());

  this.overriden.subscribe(function (input) {
    if (!input) {
      this.value(this.parent() ? this.parent().value() : this.savedValue());
      this.forced(false);
    }
  }, this);

  this.parent.subscribe(function (input) {
    if (!this.overriden() && null !== input) {
      this.value(input.value());
    }
  }, this);

  this.editable = ko.computed(function () {
    return this.overriden() || !this.parent();
  }, this);

  this.visible = ko.computed(function () {
    switch (form.settingsFilter()) {
    case 'all':
      return true;

    case 'inherited':
      return this.inherited();

    case 'overriden':
      return this.overriden();

    case 'forced':
      return this.forced();

    default:
      throw new Error('Unknown filter option: ' + form.settingsFilter());
    }
  }, this);

  this.isModified = ko.computed(function () {
    return this.overriden() !== this.savedOverriden() ||
           this.value()     !== this.savedValue()     ||
           this.forced()    !== this.savedForced();
  }, this);
}


function SettingCategory(form, name, settings) {
  this.name          = name;
  this.localizedName = N.runtime.t('admin.setting.category.' + name);

  this.settings = _.sortBy(settings, 'priority');
  this.priority = _(settings).pluck('priority').reduce(function (a, b) { return a + b; });
}


function UserGroup(form, data) {
  if (!data) {
    data = {
      _id: null
    , is_protected: false
    , parent_group: null
    , short_name: ''
    , overriden_settings: []
    , forced_settings: []
    , setting_values: {}
    };
  }

  this.id          = data._id;
  this.isProtected = data.is_protected;

  this.name          = ko.observable(data.short_name);
  this.savedName     = ko.observable(data.short_name);
  this.localizedName = ko.computed(function () {
    return this.name() ? N.runtime.t('users.usergroup.' + this.name()) : null;
  }, this);

  this.parentId      = ko.observable(data.parent_group);
  this.savedParentId = ko.observable(this.parentId());

  this.parent = ko.computed({
    read:  function () { return _.find(form.otherGroups, { id: this.parentId() }); }
  , write: function (input) { this.parentId(input ? input.id : null); }
  , owner: this
  });

  this.settings       = [];
  this.settingByName  = {};
  this.categories     = [];
  this.categoryByName = {};

  _.forEach(form.settingSchemas, function (schema, name) {
    var setting = new Setting(form, name, schema, {
      group:     this
    , value:     data.setting_values[name]
    , overriden: _.contains(data.overriden_settings, name)
    , forced:    _.contains(data.forced_settings, name)
    });

    this.settings.push(setting);
    this.settingByName[name] = setting;
  }, this);

  _(form.settingSchemas).pluck('category_key').unique().forEach(function (name) {
    var category = new SettingCategory(form, name, _.select(this.settings, { category: name }));

    this.categories.push(category);
    this.categoryByName[name] = category;
  }, this);

  this.settings.sort(function (a, b) { return a.priority - b.priority; });
  this.categories.sort(function (a, b) { return a.priority - b.priority; });

  this.isModified = ko.computed(function () {
    return this.name()     !== this.savedName()     ||
           this.parentId() !== this.savedParentId() ||
           _.any(this.settings, function (setting) { return setting.isModified(); });
  }, this);
}

UserGroup.prototype.dumpPlainData = function () {
  var result = {
    short_name:         this.name()
  , parent_group:       this.parentId()
  , overriden_settings: []
  , forced_settings:    []
  , setting_values:     {}
  };

  _.forEach(this.settings, function (setting) {
    if (setting.overriden() || !setting.parent()) {
      result.overriden_settings.push(setting.name);
    }

    if (setting.forced()) {
      result.forced_settings.push(setting.name);
    }

    result.setting_values[setting.name] = setting.value();
  });

  return result;
};


function Form(page_data) {
  this.isNew        = false;
  this.allGroups    = [];
  this.currentGroup = null;
  this.otherGroups  = [];

  this.settingSchemas = page_data.setting_schemas;
  this.settingsFilter = ko.observable('all');

  _.forEach(page_data.groups_data, function (data) {
    var group = new UserGroup(this, data);

    if (page_data.current_group_id && page_data.current_group_id === group.id) {
      this.currentGroup = group;
    } else {
      this.allGroups.push(group);
      this.otherGroups.push(group);
    }
  }, this);

  if (!this.currentGroup) {
    this.isNew = true;
    this.currentGroup = new UserGroup(this);
  }

  this.allGroups.push(this.currentGroup);
}

Form.prototype.submitCreate = function submitCreate() {
  var payload = this.currentGroup.dumpPlainData();

  console.log(payload);

  N.io.rpc('admin.users.usergroups.create', payload, function (err) {
    if (err) {
      return; // User should receive error notification automatically.
    }

    N.wire.emit('notify', { type: 'info', message: t('submited') });
  });
};

Form.prototype.submitUpdate = function submitUpdate() {
  var payload = {};

  _.forEach(this.allGroups, function (group) {
    if (!group.isModified()) {
      return;
    }

    payload[group.id] = group.dumpPlainData();
  });

  console.log(payload);

  N.io.rpc('admin.users.usergroups.update', payload, function (err) {
    if (err) {
      return; // User should receive error notification automatically.
    }

    N.wire.emit('notify', { type: 'info', message: t('submited') });
  });
};

Form.prototype.submit = function submit() {
  if (this.isNew) {
    this.submitCreate();
  } else {
    this.submitUpdate();
  }
};


module.exports = Form;
