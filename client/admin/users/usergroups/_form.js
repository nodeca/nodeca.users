// Logic of the usergroup editor interface. It's used by "new" and "edit" pages.
//
'use strict';


const _  = require('lodash');
const ko = require('knockout');


/*eslint-disable no-redeclare*/
let N;


// Single setting of a usergroup.
//
// form (Form): Root form object. See below for Form class.
// name (String): Unique identofier of the setting.
// schema (Object): N.config.setting_schemas.usergroup[name]
// config (Object): Must contain: `group`, `overriden`, `forced`, and `value`.
//
function Setting(form, name, schema, config) {
  var tName = 'admin.core.setting_names.' + name,
      tHelp = 'admin.core.setting_names.' + name + '_help';

  // Read-only slots.
  //
  this.elementId     = 'setting_' + name; // HTML id attribute.
  this.name          = name;
  this.defaultValue  = schema.default;
  this.valueType     = schema.type;
  this.categoryKey   = schema.category_key;
  this.priority      = schema.priority;
  this.ownerGroup    = config.group;
  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : null;

  // Setting model of `ownerGroup` from which the current setting should inherit
  // the value when it isn't overriden.
  this.parentSetting = ko.computed(() => {
    if (this.ownerGroup && this.ownerGroup.parentGroup()) {
      return this.ownerGroup.parentGroup().settingsByName[this.name];
    }
    return null;
  }, this);

  // Private writable slots.
  //
  this._overriden = ko.observable(Boolean(config.overriden));
  this._forced    = ko.observable(Boolean(config.forced));
  this._value     = ko.observable(config.value);

  // Public proxy slots. These allows dynamically recompute _shown_ data on
  // parent group change or overriden flag unmark AND keep user's own input
  // at the same time.
  //
  this.overriden = ko.computed({
    read() { return this._overriden() || !this.ownerGroup.parentGroup(); },
    write: this._overriden,
    owner: this
  }).extend({ dirty: false });

  this.inherited = ko.computed(() => !this.overriden());

  this.forced = ko.computed({
    read() { return this.overriden() && this._forced(); },
    write: this._forced,
    owner: this
  }).extend({ dirty: false });

  this.value = ko.computed({
    read() {
      if (this.overriden()) {
        return this.valueType === 'number' ? Number(this._value()) : this._value();

      } else if (this.parentSetting()) {
        return this.parentSetting().value();
      }

      return this.defaultValue;
    },
    write(newValue) {
      this.overriden(true);
      this._value(newValue);
    },
    owner: this
  }).extend({ dirty: false });

  // Helpers.
  //
  this.visible = ko.computed(() => {
    var filter = form.filter();

    if (filter === 'overriden')      return this.overriden();
    else if (filter === 'inherited') return this.inherited();
    else if (filter === 'forced')    return this.forced();

    return true;
  }, this);

  this.isDirty = ko.computed(() => {
    if (this.overriden.isDirty()) return true;

    if (this.overriden()) {
      if (this.value.isDirty()) return true;
      if (this.forced.isDirty()) return true;
    }

    return false;
  }, this);
}

// Marks all trackable data slots as saved.
//
Setting.prototype.markClean = function markClean() {
  this.overriden.markClean();
  this.forced.markClean();
  this.value.markClean();
};

// Returns data suitable for the server.
//
Setting.prototype.getOutputData = function getOutputData() {
  return {
    value: this.value(),
    force: this.forced()
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
  this.localizedName = N.runtime.t('admin.core.category_names.' + name);

  this.settings = _.sortBy(settings, 'priority');
  this.priority = _(settings).map('priority').reduce((a, b) => a + b);
}


// Single known user group. Used either for displayed group and for groups in
// the "inherits" list.
//
// form (Form): See below for Form class.
// data (Object): UserGroup data retrieved from the database at the server-side.
// The used fields are: _id, is_protected, parent_group and settings.
//
function UserGroup(form, data) {
  data = data || {};

  let settings = data.settings || {};

  // Read-only slots.
  //
  this.id          = data._id || null;
  this.isProtected = data.is_protected || false;

  // Writable and savable slots.
  //
  this.name     = ko.observable(data.short_name || '').extend({ dirty: false });
  this.parentId = ko.observable(data.parent_group || null).extend({ dirty: false });

  // Computed values.
  //
  this.localizedName = ko.computed(() => {
    if (this.name() && N.runtime.t.exists('admin.users.usergroup_names.' + this.name())) {
      return N.runtime.t('admin.users.usergroup_names.' + this.name());
    }
    return null;
  });

  this.parentGroup = ko.computed({
    read() { return form.groupsById ? form.groupsById[this.parentId()] : null; },
    write(group) { this.parentId(group?.id); },
    owner: this
  });

  // Related settings and categories lists.
  // See Setting and SettingCategory classes for details.
  //
  this.settings     = _(form.setting_schemas)
                          .map((schema, name) => {
                            let overriden = _.has(settings, name);

                            return new Setting(form, name, schema, {
                              group:     this,
                              overriden,
                              forced:    overriden ? settings[name].force : false,
                              value:     overriden ? settings[name].value : schema.default
                            });
                          })
                          .sortBy('priority')
                          .value();

  this.settingsByName = this.settings.reduce((acc, s) => {
    acc[s.name] = s;
    return acc;
  }, {});

  this.categories    = _(form.setting_schemas)
                          .map('category_key')
                          .uniq()
                          .map(name => new SettingCategory(
                            form,
                            name,
                            _.filter(this.settings, { categoryKey: name })
                          ))
                          .sortBy('priority')
                          .value();

  // Helpers.
  //
  this.isDirty = ko.computed(() =>
    this.name.isDirty()     ||
    this.parentId.isDirty() ||
    this.settings.some(s => s.isDirty())
  );
}

// Checks if the given group is a descendant of this.
//
UserGroup.prototype.isDescendantOf = function isDescendantOf(group) {
  if (this.parentGroup()) {
    return this.parentId() === group.id ||
           this.parentGroup().isDescendantOf(group);
  }
  return false;
};

// Marks all trackable data slots and related settings as saved.
//
UserGroup.prototype.markClean = function markClean() {
  this.name.markClean();
  this.parentId.markClean();
  _.invokeMap(this.settings, 'markClean');
};

// Returns data suitable for the server.
//
UserGroup.prototype.getOutputData = function getOutputData() {
  let result = {
    short_name:   this.name(),
    parent_group: this.parentId(),
    settings: {}
  };

  // Add `_id` property only when editing an existent group (not for new).
  if (this.id) result._id = this.id;

  this.settings.forEach(function (setting) {
    if (setting.overriden()) {
      result.settings[setting.name] = setting.getOutputData();
    } else {
      result.settings[setting.name] = null;
    }
  });

  return result;
};


// Root view model of the page. It has two modes: 'create' and 'update'.
//
// page_data.setting_schemas (Object): N.config.setting_schemas.usergroup
// page_data.groups_data (Array): List of all existent user groups.
// page_data.current_group_id (String, Optional): ObjectID if editing an
// existent group. Should be omitted for creating a new group.
//
function Form(page_data) {
  this.setting_schemas = page_data.setting_schemas;

  // Settings filter interface switcher.
  this.filter = ko.observable('');

  this.groups     = [];
  this.groupsById = {};

  // Create view models for all group data recieved from the server.
  page_data.groups_data.forEach(function (data) {
    var group = new UserGroup(this, data);
    this.groups.push(group);
    this.groupsById[group.id] = group;
  }, this);

  this.isNewGroup = !_.has(page_data, 'current_group_id');

  // Create or find the group to edit by the user.
  if (this.isNewGroup) {
    this.currentGroup = new UserGroup(this);
  } else {
    this.currentGroup = _.find(this.groups, { id: page_data.current_group_id });
  }

  // Select groups suitable for 'inherits' list.
  // Excludes current group and it's descendants.
  this.otherGroups = this.groups.filter(
    group => group.id !== this.currentGroup.id && !group.isDescendantOf(this.currentGroup));
}

// Sends 'create' request for `currentGroup`.
//
Form.prototype.create = function create() {
  Promise.resolve()
    .then(() => N.io.rpc('admin.users.usergroups.create', this.currentGroup.getOutputData()))
    .then(() => {
      this.currentGroup.markClean();

      return N.wire.emit('notify.info', N.runtime.t('admin.users.usergroups.form.created'));
    })
    .then(() => N.wire.emit('navigate.to', { apiPath: 'admin.users.usergroups.index' }))
    .catch(err => N.wire.emit('error', err));
};

// Sends 'update' request for `currentGroup`.
//
Form.prototype.update = function update() {
  Promise.resolve()
    .then(() => N.io.rpc('admin.users.usergroups.update', this.currentGroup.getOutputData()))
    .then(() => {
      this.currentGroup.markClean();

      return N.wire.emit('notify.info', N.runtime.t('admin.users.usergroups.form.updated'));
    })
    .catch(err => N.wire.emit('error', err));
};

// Sends save request to the server.
//
Form.prototype.submit = function submit() {
  if (this.isNewGroup) this.create();
  else this.update();
};


module.exports = function (_N) {
  if (!N) N = _N;

  return Form;
};
