'use strict';


var _  = require('lodash');
var ko = require('knockout');


function Setting(form, name, schema, config) {
  var tName = 'admin.setting.' + name
    , tHelp = 'admin.setting.' + name + '_help';

  this.pageId       = 'setting_' + name;
  this.name         = name;
  this.defaultValue = schema['default'];
  this.valueType    = schema.type;
  this.categoryKey  = schema.category_key;
  this.priority     = schema.priority;
  this.ownerGroup   = config.group;

  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : null;

  //////////////////////////////////////////////////////////////////////////////

  this.parentSetting = ko.computed(function () {
    if (this.ownerGroup && this.ownerGroup.parentGroup()) {
      return this.ownerGroup.parentGroup().settingsByName[this.name];
    } else {
      return null;
    }
  }, this);

  //////////////////////////////////////////////////////////////////////////////

  this.savedOverriden = ko.observable(Boolean(config.overriden));
  this.savedForced    = ko.observable(Boolean(config.forced));
  this.savedValue     = ko.observable('number' === schema.type ?
                                      Number(config.value)     :
                                      config.value);

  this._overriden = ko.observable(this.savedOverriden());
  this._forced    = ko.observable(this.savedForced());
  this._value     = ko.observable(this.savedValue());

  this.overriden = ko.computed({
    read:  function () { return this._overriden() || !this.ownerGroup.parentGroup(); }
  , write: this._overriden
  , owner: this
  });

  this.inherited = ko.computed(function () { return !this.overriden(); }, this);

  this.forced = ko.computed({
    read:  function () { return this.overriden() && this._forced(); }
  , write: this._forced
  , owner: this
  });

  this.value = ko.computed({
    read: function () {
      if (this.overriden()) {
        return 'number' === this.valueType ?
               Number(this._value())       :
               this._value();

      } else if (this.parentSetting()) {
        return this.parentSetting().value();

      } else {
        return this.defaultValue;
      }
    }
  , write: function (newValue) {
      this.overriden(true);
      this._value(newValue);
    }
  , owner: this
  });

  //////////////////////////////////////////////////////////////////////////////

  this.visible = ko.computed(function () {
    var filter = form.filter();

    if (filter && this.hasOwnProperty(filter)) {
      return this[filter].call(this);
    } else {
      return true;
    }
  }, this);

  this.isModified = ko.computed(function () {
    if (this.overriden() !== this.savedOverriden()) {
      return true;
    }

    if (this.overriden()) {
      if (this.value() !== this.savedValue()) {
        return true;
      }
      if (this.forced() !== this.savedForced()) {
        return true;
      }
    }

    return false;
  }, this);
}

Setting.prototype.save = function save() {
  this.savedOverriden(this.overriden());
  this.savedForced(this.forced());
  this.savedValue(this.value());
};

Setting.prototype.dump = function dump() {
  return {
    value:  this.value()
  , forced: this.forced()
  };
};


function SettingCategory(form, name, settings) {
  this.name          = name;
  this.localizedName = N.runtime.t('admin.setting.category.' + name);

  this.settings = _.sortBy(settings, 'priority');
  this.priority = _(settings).pluck('priority').reduce(function (a, b) { return a + b; });
}


function UserGroup(form, data) {
  data = data || {};

  var rawSettings;

  if (data.raw_settings) {
    rawSettings = data.raw_settings.usergroup || {};
  } else {
    rawSettings = {};
  }

  this.objectId    = data._id || null;
  this.isProtected = data.is_protected || false;

  this.savedName = ko.observable(data.short_name || '');
  this.name      = ko.observable(this.savedName());

  this.localizedName = ko.computed(function () {
    return this.name() ? N.runtime.t('users.usergroup.' + this.name()) : null;
  }, this);

  this.savedParentId = ko.observable(data.parent_group || null);
  this.parentId      = ko.observable(this.savedParentId());

  this.parentGroup = ko.computed({
    read:  function () { return form.groupsById[this.parentId()]; }
  , write: function (group) { this.parentId(group ? group.objectId : null); }
  , owner: this
  });

  this.settings         = [];
  this.settingsByName   = {};
  this.categories       = [];
  this.categoriesByName = {};

  _.forEach(form.setting_schemas, function (schema, name) {
    var setting, overriden = _.has(rawSettings, name);

    setting = new Setting(form, name, schema, {
      group:     this
    , overriden: overriden
    , forced:    overriden ? rawSettings[name].force : false
    , value:     overriden ? rawSettings[name].value : schema['default']
    });

    this.settings.push(setting);
    this.settingsByName[name] = setting;
  }, this);

  _(form.setting_schemas).pluck('category_key').unique().forEach(function (name) {
    var category = new SettingCategory(form, name, _.select(this.settings, { categoryKey: name }));

    this.categories.push(category);
    this.categoriesByName[name] = category;
  }, this);

  this.settings.sort(function (a, b) { return a.priority - b.priority; });
  this.categories.sort(function (a, b) { return a.priority - b.priority; });

  this.isModified = ko.computed(function () {
    return this.name()     !== this.savedName()     ||
           this.parentId() !== this.savedParentId() ||
           _.any(this.settings, function (setting) { return setting.isModified(); });
  }, this);
}

UserGroup.prototype.save = function () {
  this.savedName(this.name());
  this.savedParentId(this.parentId());
  _.invoke(this.settings, 'save');
};

UserGroup.prototype.dump = function () {
  var result = {
    short_name:   this.name()
  , parent_group: this.parentId()
  , raw_settings: {}
  };

  if (this.objectId) {
    result._id = this.objectId;
  }

  _.forEach(this.settings, function (setting) {
    if (setting.overriden()) {
      result.raw_settings[setting.name] = setting.dump();
    }
  });

  return result;
};


function Form(translator, page_data) {
  this.t = translator;
  this.setting_schemas = page_data.setting_schemas;

  this.groups     = [];
  this.groupsById = {};

  this.filter = ko.observable('');

  this.createMode   = !_.has(page_data, 'current_group_id');
  this.currentGroup = null;
  this.otherGroups  = [];

  if (this.createMode) {
    this.currentGroup = new UserGroup(this);
  }

  _.forEach(page_data.groups_data, function (data) {
    var group = new UserGroup(this, data);

    this.groups.push(group);
    this.groupsById[group.objectId] = group;

    if (!this.createMode && group.objectId === page_data.current_group_id) {
      this.currentGroup = group;
    } else {
      this.otherGroups.push(group);
    }
  }, this);
}

Form.prototype.create = function create() {
  var self = this;

  N.io.rpc('admin.users.usergroups.create', this.currentGroup.dump(), function (err) {
    if (err) {
      N.wire.emit('notify', { type: 'error', message: self.t('error') });
      return;
    }

    N.wire.emit('notify', { type: 'info', message: self.t('submited') });

    // TODO: Replace this with the navigate.js when it will be ported for ACP.
    window.location = N.runtime.router.linkTo('admin.users.usergroups.show');
  });
};

Form.prototype.update = function update() {
  var self = this;

  N.io.rpc('admin.users.usergroups.update', this.currentGroup.dump(), function (err) {
    if (err) {
      N.wire.emit('notify', { type: 'error', message: self.t('error') });
      return;
    }

    N.wire.emit('notify', { type: 'info', message: self.t('submited') });
  });
};

Form.prototype.submit = function submit() {
  if (this.createMode) {
    this.create();
  } else {
    this.update();
  }
};


module.exports = Form;
