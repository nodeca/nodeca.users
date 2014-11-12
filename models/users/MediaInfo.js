// Model for file page (comments, file usage...)

'use strict';

var fs          = require('fs');
var extname     = require('path').extname;
var Mongoose    = require('mongoose');
var Schema      = Mongoose.Schema;
var resize      = require('./_lib/resize');
var resizeParse = require('../../server/_lib/resize_parse');
var util        = require('util');

module.exports = function (N, collectionName) {

  var mediaConfig;


  var MediaInfo = new Schema({
    media_id        : Schema.Types.ObjectId,

    // image_sizes contains list of previews size:
    //
    // {
    //   orig: { width: 1280, height: 800 },
    //   md: { width: 640, height: 400 },
    //   ...
    // }
    image_sizes    : Schema.Types.Mixed,
    user_id        : Schema.Types.ObjectId,
    album_id       : Schema.Types.ObjectId,
    ts             : { 'type': Date, 'default': Date.now },
    type           : { 'type': String, 'enum': [ 'image', 'medialink', 'binary' ], 'default': 'binary' },
    medialink_html : String,

    // medialink_data contains:
    //
    // {
    //   provider     : String,
    //   src          : String,
    //   thumb        : String,
    //   video_width  : Number,
    //   video_height : Number,
    //   video_url    : String
    // }
    medialink_data : Schema.Types.Mixed,

    file_size      : { 'type': Number, 'default': 0 },
    file_name      : String,
    description    : String,
    exists         : { 'type': Boolean, 'default': true }
  }, {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Media page, routing
  MediaInfo.index({ media_id: 1 });

  // - Album page, fetch medias
  // - Media page, fetch next and prev _id's
  MediaInfo.index({ album_id: 1, exists: 1, _id: 1 });

  // - "All medias" page, medias list, sorted by date
  // - User medias size (users.media.upload)
  //
  // TODO: Aggregation $groups can't use coverage index.
  // TODO: All user's medias will be selected to calculate $sum. Check performance on production
  MediaInfo.index({ user_id: 1, exists: 1, ts: -1 });

  //////////////////////////////////////////////////////////////////////////////


  // Remove files with previews
  //
  MediaInfo.pre('remove', function (callback) {
    if (this.type === 'medialink') {
      callback();
      return;
    }

    N.models.core.File.remove(this.media_id, true, callback);
  });


  var saveFile = function (path, name, maxSize, callback) {
    fs.stat(path, function (err, stats) {
      if (err) {
        callback(err);
        return;
      }

      if (stats.size > maxSize) {
        callback(new Error('Can\'t save file: max size exceeded'));
        return;
      }

      var storeOptions = {
        metadata: {
          origName: name
        }
      };

      N.models.core.File.put(path, storeOptions, function (err, info) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, { id: info._id, size: stats.size });
      });
    });
  };


  // Create media with original image with previews or binary file
  //
  // - options
  //   - album_id
  //   - user_id
  //   - path - file path
  //   - name - (optional) original file name (required for binary files).
  //   - ext  - (optional) file extension (needed only if path without extension)
  //
  // - callback(err, media)
  //
  MediaInfo.statics.createFile = function (options, callback) {
    var media = new N.models.users.MediaInfo();
    media._id = new Mongoose.Types.ObjectId();
    media.user_id = options.user_id;
    media.album_id = options.album_id;

    var format;
    // Format (extension) taken from options.name, options.ext or options.path in same order
    if (options.ext) {
      format = options.ext;
    } else {
      format = extname(options.path).replace('.', '').toLowerCase();
    }

    // Is config for this type exists
    if (!mediaConfig.types[format]) {
      callback(new Error('Can\'t save file: \'' + format + '\' not supported'));
      return;
    }

    var typeConfig = mediaConfig.types[format];
    var supportedImageFormats = [ 'bmp', 'gif', 'jpg', 'jpeg', 'png' ];

    // Just save if file is not an image
    if (supportedImageFormats.indexOf(format) === -1) {

      if (!options.name) {
        callback(new Error('Can\'t save file: you must specify options.name for binary files'));
        return;
      }

      saveFile(options.path, options.name, typeConfig.max_size || mediaConfig.max_size, function (err, data) {
        if (err) {
          callback(err);
          return;
        }

        media.type = 'binary';
        media.media_id = data.id;
        media.file_size = data.size;
        media.file_name = options.name;

        media.save(function (err) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, media);
        });
      });
      return;
    }

    resize(
      options.path,
      {
        store: N.models.core.File,
        ext: format,
        maxSize: typeConfig.max_size || mediaConfig.max_size,
        resize: typeConfig.resize
      },
      function (err, data) {
        if (err) {
          callback(err);
          return;
        }

        media.type = 'image';
        media.image_sizes = data.images;
        media.media_id = data.id;
        media.file_size = data.size;

        media.save(function (err) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, media);
        });
      }
    );
  };


  N.wire.on('init:models', function emit_init_MediaInfo(__, callback) {
    // Read config
    try {
      mediaConfig = resizeParse(N.config.users.uploads);
    } catch (e) {
      callback(util.format('Error in uploads config: %s.', e.message));
      return;
    }

    N.wire.emit('init:models.' + collectionName, MediaInfo, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_MediaInfo(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
