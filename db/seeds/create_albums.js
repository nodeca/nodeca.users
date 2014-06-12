// Create demo albums for 'admin' user and moderators in first forum section
'use strict';

var async = require('async');
var Charlatan = require('charlatan');
var path = require('path');
var walkSync = require('fs-tools').walkSync;
var _ = require('lodash');
var numCPUs = require('os').cpus().length;

var ALBUMS_COUNT = 14;
var MIN_ALBUM_PHOTOS_= 0;
var MAX_ALBUM_PHOTOS = 5;

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
      async.timesSeries(Charlatan.Helpers.rand(MIN_ALBUM_PHOTOS_, MAX_ALBUM_PHOTOS), function (id, cb) {
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


module.exports = function (N, callback) {
  models = N.models;

  async.series([
    function (next) {

      // Get 'admin' user id to use it as reference for albums and media
      models.users.User.findOne({ 'nick': 'admin' }).lean(true).exec(function (err, user) {
        if (err) { return next(err); }

        if (!user) { return next(new Error('No such user: admin')); }

        next(null, [user._id]);
      });

    },
    function (next) {
      // Create demo albums for moderators in first forum section

      // Fetch forum section with smallest hid
      models.forum.Section.findOne({}).sort('hid').lean(true).exec(function (err, parentSection) {
        if (err) { return next(err); }

        // Fetch subsections
        models.forum.Section.find({ 'parent': parentSection._id }).lean(true).exec(function (err, sections) {
          if (err) { return next(err); }

          // Prepare each moderator in subsections
          var usersId = [];
          _.each(sections, function (section) {
            _.each(section.moderators, function (moderatorId) {
              usersId.push(moderatorId);
            });
          });
          next(null, usersId);

        });
      });

    }
  ], function (err, results) {
    var usersId = [];
    _.each(results, function (result) {
      usersId = _.union(usersId, result);
    });

    // Create albums for prepared user list
    async.eachLimit(usersId, numCPUs, function (userId, next) {
      createMultipleAlbums(userId, next);
    }, callback);
  });
};
