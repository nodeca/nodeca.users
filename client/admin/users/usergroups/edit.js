'use strict';


var _  = require('lodash');
var ko = require('knockout');


var settingSchemas = null;
var allGroupsData  = null;
var currentGroupId = null;


function saveChanges() {
}


function showSettings() {
}


function SettingModel(name, schema, config) {
  var tName = 'admin.setting.' + name
    , tHelp = 'admin.setting.' + name + '_help';

  this.id       = 'setting_' + name;
  this.name     = name;
  this.type     = schema.type;
  this.category = schema.category_key;
  this.priotity = schema.priority;

  this.localizedName = N.runtime.t(tName);
  this.localizedHelp = N.runtime.t.exists(tHelp) ? N.runtime.t(tHelp) : null;

  this.currentValue = ko.observable(config.value);
  this.savedValue   = ko.observable(config.value);

  this.currentOverrideFlag = ko.observable(config.overriden);
  this.savedOverrideFlag   = ko.observable(config.overriden);

  this.currentForceFlag = ko.observable(config.forced);
  this.savedForceFlag   = ko.observable(config.forced);

  this.isModified = ko.computed(function () {
    return this.currentValue()        !== this.savedValue() ||
           this.currentOverrideFlag() !== this.savedOverrideFlag() ||
           this.currentForceFlag()    !== this.savedForceFlag();
  }, this);
}


function UsergroupModel(data) {
  this.objectId = data._id;

  this.currentName = ko.observable(data.short_name);
  this.savedName   = ko.observable(data.short_name);

  this.localizedName = ko.computed(function () {
    return N.runtime.t('users.usergroup.' + this.currentName());
  }, this);

  this.isProtected = data.is_protected;

  this.settingModels = {};

  _.forEach(settingSchemas, function (schema, name) {
    var key = schema.category_key;

    if (!this.settingModels.hasOwnProperty(key)) {
      this.settingModels[key] = [];
    }

    this.settingModels[key].push(new SettingModel(name, schema, {
      value:     data.setting_values[name]
    , overriden: _.contains(data.overriden_settings, name)
    , forced:    _.contains(data.forced_settings, name)
    }));

    this.settingModels[key].sort(function (a, b) {
      return a.priority - b.priority;
    });
  }, this);

  this.settingCategories = [];

  _.keys(this.settingModels).sort().forEach(function (category) {
    this.settingCategories.push({
      name:          category
    , localizedName: N.runtime.t('admin.setting.cartegory.' + category)
    });
  }, this);

  this.isModified = ko.computed(function () {
    return _.any(this.settingModels, function (category) {
      return _.any(this.settingModels[category], function (setting) {
        return setting.isModified();
      }, this);
    }, this);
  }, this);
}


N.wire.on('navigate.done:' + module.apiPath, function () {
  var root = {};

  settingSchemas = N.runtime.page_data.settingSchemas;
  currentGroupId = N.runtime.page_data.currentGroupId;
  allGroupsData = _.map(N.runtime.page_data.allGroupsData, function (group) {
    return new UsergroupModel(group);
  });

  root.currentGroup = _.find(allGroupsData, { objectId: currentGroupId });
  root.otherGroups = _.filter(allGroupsData, function (group) {
    return group.objectId !== currentGroupId;
  });

  root.saveChanges = saveChanges;
  root.showSettings = showSettings;

  ko.applyBindings(root, $('#content').get(0));
});


N.wire.on('navigate.exit:' + module.apiPath, function () {
  settingSchemas = null;
  allGroupsData  = null;
  currentGroupId = null;

  ko.cleanNode($('#content').get(0));
});
