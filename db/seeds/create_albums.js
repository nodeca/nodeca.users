// Create demo albums for 'admin' user and moderators in first forum section
'use strict';

var async = require('async');
var Charlatan = require('charlatan');
var path = require('path');
var glob = require('glob').sync;
var _ = require('lodash');
var numCPUs = require('os').cpus().length;
var statuses = require('../../server/users/_lib/statuses.js');

var ALBUMS_COUNT = 7;
var MIN_ALBUM_PHOTOS = 0;
var MAX_ALBUM_PHOTOS = 5;
var MIN_COMMENTS = 3;
var MAX_COMMENTS = 15;

let fixt_root = path.join(__dirname, 'fixtures', 'create_albums');

var PHOTOS = glob('**/*.yml', {
  cwd: fixt_root
}).map(name => path.join(fixt_root, name));


var models;

// Creates random photos to album from test fixtures
//
function createMedia(userId, album, callback) {
  var photoPath = PHOTOS[Charlatan.Helpers.rand(0, PHOTOS.length)];

  models.users.MediaInfo.createFile({
    album_id: album,
    user_id: userId,
    path: photoPath
  }, callback);
}


// Creates one album
//
function createAlbum(userId, callback) {
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
      models.users.Album.updateInfo(album._id, true, next);
    }
  ], callback);
}


// Creates multiple albums
//
// userId - albums owner
//
function createMultipleAlbums(userId, callback) {
  async.timesSeries(ALBUMS_COUNT, function (id, next) {
    createAlbum(userId, function (err) {
      next(err);
    });
  }, callback);
}


function createAlbums(callback) {

  var user_ids = [];

  async.series([
    function (next) {
      // Create demo albums for users from administrators group

      // Get administrators group _id
      models.users.UserGroup
        .findOne({ short_name: 'administrators' })
        .select('_id')
        .lean(true)
        .exec(function (err, group) {
          if (err) {
            next(err);
            return;
          }

          // Get users from administrators group
          models.users.User.find({ usergroups: group._id }).select('_id').lean(true).exec(function (err, users) {
            if (err) {
              next(err);
              return;
            }

            if (users) {
              user_ids = user_ids.concat(_.map(users, '_id'));
            }

            next();
          });
        });
    },
    function (next) {
      // Create demo albums for moderators in first forum section

      // Fetch all sections & collect moderators
      models.forum.Section.getChildren(null, 2, function (err, sections) {
        if (err) { return next(err); }

        models.forum.Section.find()
            .where('_id').in(_.map(sections, '_id'))
            .select('moderators')
            .lean(true)
            .exec(function (err, data) {

          if (err) {
            next(err);
            return;
          }

          user_ids = user_ids.concat(_(data).map('moderators').flatten().value());
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
}


// Creates random comments to media
//
function createComment(mediaId, userId, callback) {
  var comment = new models.users.Comment();
  comment.user_id = userId;
  comment.media_id = mediaId;
  comment.ts = new Date();
  comment.text = Charlatan.Lorem.paragraph(Charlatan.Helpers.rand(1, 2));
  comment.st = statuses.comment.VISIBLE;
  comment.save(callback);
}


// Creates multiple comments
//
function createMultipleComments(mediaId, usersId, callback) {
  var commentsCount = Charlatan.Helpers.rand(MIN_COMMENTS, MAX_COMMENTS);

  async.timesSeries(commentsCount, function (id, cb) {
    createComment(mediaId, usersId[Charlatan.Helpers.rand(0, usersId.length - 1)], cb);
  }, function (err) {
    if (err) {
      callback(err);
      return;
    }

    models.users.MediaInfo.update(
      { media_id: mediaId },
      { $inc: { comments_count: commentsCount } },
      callback
    );
  });
}


function createComments(callback) {

  async.series([
    function (next) {
      models.users.MediaInfo.find().lean(true).exec(function (err, media) {
        if (err) { return next(err); }
        next(null, media);
      });

    }
  ], function (err, results) {
    if (err) { return callback(err); }

    var usersId = _.map(results[0], 'user_id');
    usersId = _.uniq(usersId);

    var mediasId = _.map(results[0], 'media_id');

    // Create comments for prepared media and user list
    async.eachLimit(mediasId, numCPUs, function (mediaId, next) {
      createMultipleComments(mediaId, usersId, next);
    }, callback);
  });
}


module.exports = function (N, callback) {
  models = N.models;

  async.series([
    createAlbums,
    createComments
  ], callback);
};
