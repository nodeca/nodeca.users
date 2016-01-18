// Create demo albums for 'admin' user and moderators in first forum section
'use strict';

const co        = require('co');
const Charlatan = require('charlatan');
const path      = require('path');
const glob      = require('glob').sync;
const _         = require('lodash');
// const numCPUs   = require('os').cpus().length;
const statuses  = require('../../server/users/_lib/statuses.js');

const ALBUMS_COUNT     = 7;
const MIN_ALBUM_PHOTOS = 0;
const MAX_ALBUM_PHOTOS = 5;
const MIN_COMMENTS     = 3;
const MAX_COMMENTS     = 15;

let fixt_root = path.join(__dirname, 'fixtures', 'create_albums');

const PHOTOS = glob('**', {
  cwd: fixt_root
}).map(name => path.join(fixt_root, name));


let models;

// Creates random photos to album from test fixtures
//
function createMedia(userId, album) {
  return models.users.MediaInfo.createFile({
    album_id: album,
    user_id: userId,
    path: PHOTOS[Charlatan.Helpers.rand(0, PHOTOS.length)]
  });
}


// Creates one album
//
let createAlbum = co.wrap(function* (userId) {
  var album = new models.users.Album();

  album.user_id = userId;
  album.title = Charlatan.Name.name();
  yield album.save();

  let repeat = Charlatan.Helpers.rand(MIN_ALBUM_PHOTOS, MAX_ALBUM_PHOTOS);

  for (let i = 0; i < repeat; i++) {
    yield createMedia(userId, album);
  }

  yield models.users.Album.updateInfo(album._id, true);
});


// Creates multiple albums
//
// userId - albums owner
//
let createMultipleAlbums = co.wrap(function* (userId) {
  for (let i = 0; i < ALBUMS_COUNT; i++) {
    yield createAlbum(userId);
  }
});


let createAlbums = co.wrap(function* () {

  let user_ids = [];

  // Collect users from administrators group

  // Get administrators group _id
  let group = yield models.users.UserGroup
                      .findOne({ short_name: 'administrators' })
                      .select('_id')
                      .lean(true);

  let users = yield models.users.User
                      .find({ usergroups: group._id })
                      .select('_id')
                      .lean(true);

  if (users) {
    user_ids = user_ids.concat(_.map(users, '_id'));
  }

  // Collect moderators in first forum section

      // Fetch all sections
  let sections = yield models.forum.Section.getChildren(null, 2);

  let data = yield models.forum.Section.find()
                    .where('_id').in(_.map(sections, '_id'))
                    .select('moderators')
                    .lean(true);

  user_ids = user_ids.concat(_(data).map('moderators').flatten().value());

  user_ids = _.uniq(user_ids.map(String));

  // Create albums for prepared user list

  // TODO use all CPUs
  /*async.eachLimit(user_ids, numCPUs, function (uid, next) {
    createMultipleAlbums(uid, next);
  }, callback);*/
  for (let i = 0; i < user_ids.length; i++) {
    yield createMultipleAlbums(user_ids[i]);
  }
});


// Creates random comments to media
//
function createComment(mediaId, userId) {
  let comment = new models.users.Comment();

  comment.user_id = userId;
  comment.media_id = mediaId;
  comment.ts = new Date();
  comment.text = Charlatan.Lorem.paragraph(Charlatan.Helpers.rand(1, 2));
  comment.st = statuses.comment.VISIBLE;

  return comment.save();
}


// Creates multiple comments
//
let createMultipleComments = co.wrap(function* (mediaId, usersId) {
  var commentsCount = Charlatan.Helpers.rand(MIN_COMMENTS, MAX_COMMENTS);

  for (let i = 0; i < commentsCount; i++) {
    yield createComment(mediaId, usersId[Charlatan.Helpers.rand(0, usersId.length - 1)]);
  }

  yield models.users.MediaInfo.update(
    { media_id: mediaId },
    { $inc: { comments_count: commentsCount } }
  );
});


let createComments = co.wrap(function* () {

  let results = yield models.users.MediaInfo.find().lean(true);

  let usersId = _.uniq(_.map(results, 'user_id'));
  let mediasId = _.map(results, 'media_id');

  // Create comments for prepared media and user list
  // TODO: use more CPUs
  for (let i = 0; i < mediasId.length; i++) {
    yield createMultipleComments(mediasId[i], usersId);
  }
});


module.exports = co.wrap(function* (N) {
  models = N.models;

  yield createAlbums();
  yield createComments();
});
