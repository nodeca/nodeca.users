// Read, validate and prepare uploads configuration for media and avatars
//
// Params:
// - config object
//
// Returns config similar to input config, but with extended 'types' property like this:
// types: {
//   png: {
//     max_size: 2000000,
//     resize: {
//       orig: { width: 1280, skip_size: 1000000, type: 'png' },
//       md: { width: 640 },
//       sm: { max_width: 170, height: 150 }
//     }
//   },
//   zip: {
//     max_size: 2000000
//   }
// }
//

'use strict';

var _           = require('lodash');
var mime        = require('mime-types');
var validator   = require('is-my-json-valid');


var resizeConfigSchema = {
  type: 'object',
  additionalProperties: false,
  patternProperties: {
    '^(orig|md|sm)$': {
      additionalProperties: false,
      properties: {
        skip_size:    { type: 'number' },
        type:         { 'enum': [ 'jpeg', 'png', 'gif' ] },
        from:         { 'enum': [ 'orig', 'md', 'sm' ] },
        width:        { type: 'number' },
        height:       { type: 'number' },
        max_width:    { type: 'number' },
        max_height:   { type: 'number' },
        jpeg_quality: { type: 'number' },
        unsharp:      { type: 'boolean' }
      }
    }
  }
};

var configSchema = {
  additionalProperties: false,
  properties: {
    extensions:    {
      type: 'array',
      uniqueItems: true,
      minItems: 1,
      items: { type: 'string', pattern: /[a-z]+/ },
      required: true
    },
    max_size:      { type: 'number' },
    jpeg_quality:  { type: 'number' },
    gif_animation: { type: 'boolean' },
    resize:        resizeConfigSchema,
    types:         {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          max_size: { type: 'number' }
        }
      },
      patternProperties: {
        '^(jpeg|png|gif)$': {
          type: 'object',
          additionalProperties: false,
          properties: {
            max_size:      { type: 'number' },
            jpeg_quality:  { type: 'number' },
            gif_animation: { type: 'boolean' },
            resize:        resizeConfigSchema
          }
        }
      }
    }
  }
};

var validate = validator(configSchema, { verbose: true });


module.exports = _.memoize(function (uploadsConfig) {
  var config = _.cloneDeep(uploadsConfig);

  config.types = config.types || {};
  config.resize = config.resize || {};

  // Check uploads options, throw an error if validation failed
  if (!validate(config)) {
    var errorMessages = validate.errors.map(function (error) {
      return `'${error.field}' ${error.message} '${error.value}'`;
    });

    throw new Error(errorMessages.join(', '));
  }

  var typesOptions = {};

  // Combine all options by file type
  _.forEach(config.extensions, function (ext) {
    var mimeType = mime.lookup(ext);

    // Get real extension (like 'jpg' instead 'jpeg')
    var realExtension = mime.extension(mimeType);

    var configForExt = {
      max_size: config.max_size
    };

    // For images fill resize options
    if (mimeType.indexOf('image/') !== -1) {
      configForExt.resize = {};

      _.forEach(config.resize || {}, function (previewOptions, key) {
        // Get specific preview options by type
        var previewTypeOptions = ((config.types[realExtension] || {}).resize || {})[key] || {};

        // Override preview options by type preview options
        configForExt.resize[key] = _.assign({}, previewOptions, previewTypeOptions);

        // For jpeg preview assign 'jpeg_quality' option
        if (configForExt.resize[key].type === 'jpeg' ||
            (realExtension === 'jpeg' && !configForExt.resize[key].type)) {
          configForExt.resize[key].jpeg_quality =
            configForExt.resize[key].jpeg_quality || previewTypeOptions.jpeg_quality || config.jpeg_quality;
        }

        // For gif preview assign 'gif_animation' option
        if (configForExt.resize[key].type === 'gif' ||
            (realExtension === 'gif' && !configForExt.resize[key].type)) {
          configForExt.resize[key].gif_animation = previewTypeOptions.gif_animation || config.gif_animation;
        }
      });
    }

    // Override global options by type options
    _.assign(configForExt, _.omit(config.types[realExtension] || {}, 'resize'));

    typesOptions[ext] = configForExt;
  });

  // Override type options by result
  config.types = typesOptions;

  return config;
}, function (uploadsConfig) {
  return JSON.stringify(uploadsConfig);
});
