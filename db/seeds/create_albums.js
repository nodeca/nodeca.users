// Create demo albums for 'admin' user and moderators in first forum section
'use strict';

var async = require('async');
var Charlatan = require('charlatan');
var path = require('path');
var walkSync = require('fs-tools').walkSync;

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
  var photoName = path.basename(photoPath);

  models.core.File.put(photoPath, { 'metadata': { 'origName': photoName } }, function (err, file) {
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

        createMultipleAlbums(user._id, next);
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

          // For each moderator in subsection apply demo albums
          async.eachSeries(sections, function (section, next) {
            async.eachSeries(section.moderators, function (moderatorId, next) {
              createMultipleAlbums(moderatorId, next);
            }, next);
          }, next);
        });
      });

    }
  ], callback);
};
