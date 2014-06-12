// Reads and parses size configuration for media and avatars
// [ { 'size': string, 'width': number, 'height': number, 'quality': number } ]
'use strict';

var _ = require('lodash');

module.exports = function (config) {
  var sizes = [];

  _.each(config, function (val, key) {
    // If size was overridden by null
    if (!val) {
      return;
    }

    if (!val.width || !val.height) {
      return new Error('Can\'t read size config: width and height should be positive (in ' + key + ')');
    }
    
    sizes.push({ 'size': key, 'width': val.width, 'height': val.height, 'quality': val.quality || 85 });
  });

  sizes.sort(function (a, b) { return b.height - a.height; });

  if (sizes.length < 1 || sizes[0].size !== 'orig') {
    return new Error('Can\'t read size config: orig should have maximum size');
  }

  return sizes;
};
