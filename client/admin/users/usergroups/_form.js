// Logic of the usergroup editor interface. It's used by "new" and "edit" pages.
//


'use strict';


var _  = require('lodash');
var ko = require('knockout');


ko.extenders.trackable = function (target) {
  var savedValue = ko.observable(target());

  target.isModified = ko.computed(function () {
    return savedValue() !== target();
  });

  target.markSaved = function () {
    savedValue(target());
  };

  return target;
};


// Single setting of a usergroup.
//
// form (Form): Root form object. See below for Form class.
// name (String): Unique identofier of the setting.
// schema (Object): N.config.setting_schemas.usergroup[name]
// config (Object): Must contain: `group`, `overriden`, `forced`, and `value`.
//
function Setting(form, name, schema, config) {
  var tName = 'admin.setting.' + name
    , tHelp = 'admin.setting.' + name + '_help';

  // Read-only slots.
  //
  this.elementId     = 'setting_' + name; // HTML id attribute.
  this.name          = name;
  this.defaultValue  = schema['default'];
  this.valueType     = schema.type;
  this.categoryKey   = schema.category_key;
  this.priority      = schema.priority;
  this.ownerGroup    = config.group;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : null;

  // Setting model of `ownerGroup` from which the current setting should inherit
  // the value when it isn't overriden.
  this.parentSetting = ko.computed(function () {
    if (this.ownerGroup && this.ownerGroup.parentGroup()) {
      return this.ownerGroup.parentGroup().settingsByName[this.name];
    } else {
      return null;
    }
  }, this);

  // Private writable slots.
  //
  this._overriden = ko.observable(Boolean(config.overriden));
  this._forced    = ko.observable(Boolean(config.forced));
  this._value     = ko.observable('number' === schema.type ? Number(config.value) : config.value);

  // Public proxy slots. These allows dynamically recompute _shown_ data on
  // parent group change or overriden flag unmark AND keep user's own input
  // at the same time.
  //
  this.overriden = ko.computed({
    read:  function () { return this._overriden() || !this.ownerGroup.parentGroup(); }
  , write: this._overriden
  , owner: this
  }).extend({ trackable: true });

  this.inherited = ko.computed(function () { return !this.overriden(); }, this);

  this.forced = ko.computed({
    read:  function () { return this.overriden() && this._forced(); }
  , write: this._forced
  , owner: this
  }).extend({ trackable: true });

  this.value = ko.computed({
    read: function () {
      if (this.overriden()) {
        return 'number' === this.valueType ? Number(this._value()) : this._value();

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
  }).extend({ trackable: true });

  // Helpers.
  //
  this.visible = ko.computed(function () {
    var filter = form.filter();

    if ('overriden' === filter) {
      return this.overriden();

    } else if ('inherited' === filter) {
      return this.inherited();

    } else if ('forced' === filter) {
      return this.forced();

    } else {
      return true;
    }
  }, this);

  this.isModified = ko.computed(function () {
    if (this.overriden.isModified()) {
      return true;
    }

    if (this.overriden()) {
      if (this.value.isModified()) {
        return true;
      }
      if (this.forced.isModified()) {
        return true;
      }
    }

    return false;
  }, this);
}

// Marks all trackable data slots as saved.
//
Setting.prototype.markSaved = function markSaved() {
  this.overriden.markSaved();
  this.forced.markSaved();
  this.value.markSaved();
};

// Returns data suitable for the server.
//
Setting.prototype.getOutputData = function getOutputData() {
  return {
    value: this.value()
  , force: this.forced()
  };
};


// Named group of settings. (visible interface element)
//
// form (Form): See below for Form class.
// name (String): Title translation key.
// settings (Array): List of related settings.
//
function SettingCategory(form, name, settings) {
  this.name          = name;
  this.localizedName = N.runtime.t('admin.setting.category.' + name);

  this.settings = _.sortBy(settings, 'priority');
  this.priority = _(settings).pluck('priority').reduce(function (a, b) { return a + b; });
}


// Single known user group. Used either for displayed group and for groups in
// the "inherits" list.
//
function UserGroup(form, data) {
  data = data || {};

  var rawSettings;

  if (data.raw_settings) {
    rawSettings = data.raw_settings.usergroup || {};
  } else {
    rawSettings = {};
  }

  // Read-only slots.
  //
  this.objectId    = data._id || null;
  this.isProtected = data.is_protected || false;

  // Writable and savable slots.
  //
  this.name     = ko.observable(data.short_name || '').extend({ trackable: true });
  this.parentId = ko.observable(data.parent_group || null).extend({ trackable: true });

  // Computed values.
  //
  this.localizedName = ko.computed(function () {
    return this.name() ? N.runtime.t('users.usergroup.' + this.name()) : null;
  }, this);

  this.parentGroup = ko.computed({
    read:  function () { return form.groupsById[this.parentId()]; }
  , write: function (group) { this.parentId(group ? group.objectId : null); }
  , owner: this
  });

  // Related settings and categories lists.
  // See Setting and SettingCategory classes for details.
  //
  this.settings         = [];
  this.settingsByName   = {};
  this.categories       = [];
  this.categoriesByName = {};

  // Collect setting models.
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

  this.settings = _.sortBy(this.settings, 'priority');

  // Collect category models.
  _(form.setting_schemas).pluck('category_key').unique().forEach(function (name) {
    var category = new SettingCategory(form, name, _.select(this.settings, { categoryKey: name }));

    this.categories.push(category);
    this.categoriesByName[name] = category;
  }, this);

  this.categories = _.sortBy(this.categories, 'priority');

  // Helpers.
  //
  this.isModified = ko.computed(function () {
    return this.name.isModified()     ||
           this.parentId.isModified() ||
           _(this.settings).invoke('isModified').any();
  }, this);
}

// Marks all trackable data slots and related settings as saved.
//
UserGroup.prototype.markSaved = function markSaved() {
  this.name.markSaved();
  this.parentId.markSaved();
  _.invoke(this.settings, 'markSaved');
};

// Returns data suitable for the server.
//
UserGroup.prototype.getOutputData = function getOutputData() {
  var result = {
    short_name:   this.name()
  , parent_group: this.parentId()
  , raw_settings: {}
  };

  // Add `_id` property only when `this` is a persistent (i.e. saved) group.
  if (this.objectId) {
    result._id = this.objectId;
  }

  _.forEach(this.settings, function (setting) {
    if (setting.overriden()) {
      result.raw_settings[setting.name] = setting.getOutputData();
    }
  });

  return result;
};


// Root view model of the page. It has two modes: 'create' and 'update'.
//
// page_data.setting_schemas (Object): N.config.setting_schemas.usergroup
// page_data.groups_data (Array): List of all existent user groups.
// page_data.current_group_id (String, Optional): ObjectID of a group for edit.
// If this identifier is provided, the form will use 'update' mode.
//
function Form(page_data) {
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

// Sends 'create' request for `currentGroup`.
//
Form.prototype.create = function create() {
  var self = this;

  N.io.rpc('admin.users.usergroups.create', this.currentGroup.getOutputData(), function (err) {
    if (err) {
      N.wire.emit('notify', {
        type: 'error'
      , message: N.runtime.t(N.io.BAD_REQUEST === err.code ?
                             'admin.users.usergroups.form.error.bad_request' :
                             'admin.users.usergroups.form.error.unknown')
      });
      return;
    }

    self.currentGroup.markSaved();

    N.wire.emit('notify', {
      type: 'info'
    , message: N.runtime.t('admin.users.usergroups.form.created')
    });

    // TODO: Replace this with the navigate.js when it will be ported for ACP.
    window.location = N.runtime.router.linkTo('admin.users.usergroups.show');
  });
};

// Sends 'update' request for `currentGroup`.
//
Form.prototype.update = function update() {
  var self = this;

  N.io.rpc('admin.users.usergroups.update', this.currentGroup.getOutputData(), function (err) {
    if (err) {
      N.wire.emit('notify', {
        type: 'error'
      , message: N.runtime.t(N.io.BAD_REQUEST === err.code ?
                             'admin.users.usergroups.form.error.bad_request' :
                             'admin.users.usergroups.form.error.unknown')
      });
      return;
    }

    self.currentGroup.markSaved();

    N.wire.emit('notify', {
      type: 'info'
    , message: N.runtime.t('admin.users.usergroups.form.updated')
    });
  });
};

// Sends save request to the server.
//
Form.prototype.submit = function submit() {
  if (this.createMode) {
    this.create();
  } else {
    this.update();
  }
};


module.exports = Form;
