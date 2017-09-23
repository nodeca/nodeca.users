// Model for file page (comments, file usage...)

/* eslint no-bitwise: 0 */
'use strict';


const stat        = require('util').promisify(require('fs').stat);
const extname     = require('path').extname;
const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const resize      = require('./_lib/resize');
const resizeParse = require('../../server/_lib/resize_parse');


module.exports = function (N, collectionName) {

  var mediaConfig;

  var types = {
    IMAGE: 0x1,
    MEDIALINK: 0x2,
    BINARY: 0x3,

    MASK_DELETED: 0x80
  };

  types.LIST_VISIBLE = [ types.IMAGE, types.MEDIALINK, types.BINARY ];
  types.LIST_DELETED = [
    types.IMAGE | types.MASK_DELETED,
    types.MEDIALINK | types.MASK_DELETED,
    types.BINARY | types.MASK_DELETED
  ];


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
    user           : Schema.Types.ObjectId,
    album          : Schema.Types.ObjectId,
    ts             : { type: Date, 'default': Date.now },
    type           : Number,
    medialink_html : String,

    // medialink_meta contains:
    //
    // {
    //   provider     : String,
    //   src          : String,
    //   thumb        : String,
    //   video_width  : Number,
    //   video_height : Number,
    //   video_url    : String
    // }
    medialink_meta : Schema.Types.Mixed,

    file_size      : { type: Number, 'default': 0 },
    file_name      : String,
    description    : String,

    comments_count : { type: Number, 'default': 0 }
  }, {
    versionKey: false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Media page, routing
  MediaInfo.index({ media_id: 1 });

  // - Album page, fetch medias
  // - Media page, fetch next and prev _id's
  // - Media page, count current media number in album
  MediaInfo.index({ album: 1, type: 1, media_id: 1 });

  // - "All medias" page, medias list, sorted by date
  MediaInfo.index({ user: 1, type: 1, media_id: 1 });

  //////////////////////////////////////////////////////////////////////////////

  // Export media types
  //
  MediaInfo.statics.types = types;


  // Mark media deleted and update user's media size
  //
  // - media_id
  // - revert - revert deleted media (default false)
  // - callback
  //
  MediaInfo.statics.markDeleted = async function (media_id, revert) {
    let media = await N.models.users.MediaInfo
                          .findOneAndUpdate({
                            media_id,
                            type: { $in: (revert ? types.LIST_DELETED : types.LIST_VISIBLE) }
                          }, {
                            $bit: { type: { xor: types.MASK_DELETED } }
                          })
                          .select('file_size user')
                          .lean(true);


    if (!media) return;

    await N.models.users.UserExtra.update(
      { user: media.user },
      { $inc: { media_size: media.file_size * (revert ? 1 : -1) } }
    );
  };


  // Remove files with previews
  //
  MediaInfo.pre('remove', function (callback) {
    if ((this.type & ~types.MASK_DELETED) === types.MEDIALINK) {
      callback();
      return;
    }

    Promise.resolve(N.models.core.File.remove(this.media_id, true)).asCallback(callback);
  });


  async function saveFile(path, name, maxSize) {
    let stats = await stat(path);

    if (stats.size > maxSize) {
      return new Error("Can't save file: max size exceeded");
    }

    let storeOptions = {
      metadata: {
        origName: name
      }
    };

    let info = await N.models.core.File.put(path, storeOptions);

    return { id: info._id, size: stats.size };
  }


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
  MediaInfo.statics.createFile = async function (options) {
    let media = new N.models.users.MediaInfo();
    media._id = new Mongoose.Types.ObjectId();
    media.user = options.user_id;
    media.album = options.album_id;

    let format;
    // Format (extension) taken from options.name, options.ext or options.path in same order
    if (options.ext) {
      format = options.ext;
    } else {
      format = extname(options.path).replace('.', '').toLowerCase();
    }

    // Is config for this type exists
    if (!mediaConfig.types[format]) {
      throw new Error(`Can't save file: '${format}' not supported`);
    }

    let typeConfig = mediaConfig.types[format];
    let supportedImageFormats = [ 'bmp', 'gif', 'jpg', 'jpeg', 'png' ];

    // Just save if file is not an image
    if (supportedImageFormats.indexOf(format) === -1) {

      if (!options.name) {
        throw new Error("Can't save file: you must specify options.name for binary files");
      }

      let data = await saveFile(options.path, options.name, typeConfig.max_size || mediaConfig.max_size);

      media.type = types.BINARY;
      media.media_id = data.id;
      media.file_size = data.size;
      media.file_name = options.name;
    } else {
      let comment;

      if (options.user_id) {
        let user = await N.models.users.User.findById(options.user_id);
        let date = new Date().toISOString().slice(0, 10);

        if (user) {
          let profile = N.router.linkTo('users.member', { user_hid: user.hid });

          comment = `Uploaded by ${user.nick}, ${profile}, ${date}`;
        }
      }

      let data = await resize(
        options.path,
        {
          store:   N.models.core.File,
          ext:     format,
          maxSize: typeConfig.max_size || mediaConfig.max_size,
          resize:  typeConfig.resize,
          comment
        }
      );

      media.type = types.IMAGE;
      media.image_sizes = data.images;
      media.media_id = data.id;
      media.file_size = data.size;
    }

    await media.save();
    await N.models.users.UserExtra.update(
      { user: media.user },
      { $inc: { media_size: media.file_size } }
    );

    return media;
  };


  N.wire.on('init:models', function emit_init_MediaInfo() {
    // Read config
    try {
      mediaConfig = resizeParse(N.config.users.uploads);
    } catch (e) {
      throw `Error in uploads config: ${e.message}.`;
    }

    return N.wire.emit('init:models.' + collectionName, MediaInfo);
  });


  N.wire.on('init:models.' + collectionName, function init_model_MediaInfo(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
