// Revalidator schema for params on usergroup `create` and `update` methods.
//


'use strict';


var revalidator = require('revalidator');


module.exports = {
  short_name: {
    type: 'string'
  , required: true
  , minLength: 1
  }
, parent_group: {
    type: ['string', 'null']
  , required: true
  , minLength: 24
  , maxLength: 24
  }
, raw_settings: {
    type: 'object'
  , required: true
  , conform: function (raw_settings) {
      return revalidator.validate(raw_settings, {
        properties: {
          value: {
            required: true
          }
        , force: {
            type: 'boolean'
          , required: true
          }
        }
      , additionalProperties: false
      });
    }
  }
};
