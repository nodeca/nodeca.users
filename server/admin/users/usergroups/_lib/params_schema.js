// json-schema for params on usergroup `create` and `update` methods.


'use strict';


module.exports = {
  short_name: {
    type: 'string'
  , required: true
  , minLength: 1
  }
, parent_group: {
    type: ['string', 'null']
  , required: true
  }
, raw_settings: {
    type: 'object'
  , required: true
  , patternProperties: {
      '.*': {
        type: 'object'
      , required: true
      , additionalProperties: false
      , properties: {
          value: {
            required: true
          }
        , force: {
            type: 'boolean'
          , required: true
          }
        }
      }
    }
  }
};
