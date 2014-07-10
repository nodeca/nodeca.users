// Create demo albums for 'admin' user and moderators in first forum section
'use strict';

var async = require('async');
var Charlatan = require('charlatan');
var path = require('path');
var walkSync = require('fs-tools').walkSync;
var _ = require('lodash');
var numCPUs = require('os').cpus().length;
var statuses = require('../../server/users/_lib/statuses.js');

var ALBUMS_COUNT = 7;
var MIN_ALBUM_PHOTOS = 0;
var MAX_ALBUM_PHOTOS = 5;
var MIN_COMMENTS = 3;
var MAX_COMMENTS = 15;

var PHOTOS = [];
walkSync(path.join(__dirname, 'fixtures', 'create_albums'), function (path, stat) {
  if (stat.isFile()) {
    PHOTOS.push(path);
  }
});

var models;

// Creates random photos to album from test fixtures
//
var createMedia = function (userId, album, callback) {
  var photoPath = PHOTOS[Charlatan.Helpers.rand(0, PHOTOS.length)];

  models.users.Media.createImage(photoPath, function (err, file) {
    if (err) {
      callback(err);
      return;
    }

    var media = new models.users.Media();
    media.user_id = userId;
    media.album_id = album;
    media.created_at = new Date();
    media.file_id = file;
    media.type = 'image';
    media.save(callback);
  });
};


// Creates one album
//
var createAlbum = function (userId, callback) {
  var album = new models.users.Album();

  async.series([
    function (next) {
      album.user_id = userId;
      album.title = Charlatan.Name.name();
      album.save(next);
    },
    function (next) {
      async.timesSeries(Charlatan.Helpers.rand(MIN_ALBUM_PHOTOS, MAX_ALBUM_PHOTOS), function (id, cb) {
        createMedia(userId, album, cb);
      }, next);
    },
    function (next) {
      models.users.Album.updateInfo(album._id, next);
    }
  ], callback);
};


// Creates multiple albums
//
// userId - albums owner
//
var createMultipleAlbums = function (userId, callback) {
  async.timesSeries(ALBUMS_COUNT, function (id, next) {
    createAlbum(userId, function (err) {
      next(err);
    });
  }, callback);
};


var createAlbums = function (callback) {

  var user_ids = [];

  async.series([
    function (next) {

      // Get 'admin' user id to use it as reference for albums and media
      models.users.User.findOne({ 'nick': 'admin' }).lean(true).exec(function (err, user) {
        if (err) { return next(err); }

        if (user) {
          user_ids.push(user._id);
        }

        next();
      });

    },
    function (next) {
      // Create demo albums for moderators in first forum section

      // Fetch all sections & collect moderators
      models.forum.Section.getChildren(null, 2, function (err, sections) {
        if (err) { return next(err); }

        models.forum.Section.find()
            .where('_id').in(_.pluck(sections, '_id'))
            .select('moderators')
            .lean(true)
            .exec(function(err, data) {

          if (err) {
            next(err);
            return;
          }

          user_ids = user_ids.concat(_(data)
                                        .pluck('moderators')
                                        .flatten()
                                        .valueOf());
          next();
        });
      });
    }
  ], function (err) {
    if (err) { return callback(err); }

    user_ids = _.uniq(user_ids.map(String));

    // Create albums for prepared user list
    async.eachLimit(user_ids, numCPUs, function (uid, next) {
      createMultipleAlbums(uid, next);
    }, callback);
  });
};


// Creates random comments to media
//
var createComment = function (mediaId, userId, callback) {
  var comment = new models.users.Comment();
  comment.user_id = userId;
  comment.media_id = mediaId;
  comment.created_at = new Date();
  comment.text = Charlatan.Lorem.paragraph(Charlatan.Helpers.rand(1, 2));
  comment.st = statuses.comment.VISIBLE;
  comment.save(callback);
};


// Creates multiple comments
//
var createMultipleComments = function (mediaId, usersId, callback) {
  async.timesSeries(Charlatan.Helpers.rand(MIN_COMMENTS, MAX_COMMENTS), function (id, cb) {
    createComment(mediaId, usersId[Charlatan.Helpers.rand(0, usersId.length - 1)], cb);
  }, callback);
};


var createComments = function (callback) {

  async.series([
    function (next) {
      models.users.Media.find().lean(true).exec(function (err, media) {
        if (err) { return next(err); }
        next(null, media);
      });

    }
  ], function (err, results) {
    if (err) { return callback(err); }

    var usersId = _.pluck(results[0], 'user_id');
    usersId = _.uniq(usersId);

    var mediasId = _.pluck(results[0], '_id');

    // Create comments for prepared media and user list
    async.eachLimit(mediasId, numCPUs, function (mediaId, next) {
      createMultipleComments(mediaId, usersId, next);
    }, callback);
  });
};


module.exports = function (N, callback) {
  models = N.models;

  async.series([
    createAlbums,
    createComments
  ], callback);
};
