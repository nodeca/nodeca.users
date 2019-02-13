// Create demo albums for 'admin' user and moderators in first forum section
//
'use strict';


const Promise   = require('bluebird');
const Charlatan = require('charlatan');
const path      = require('path');
const glob      = require('glob').sync;
const _         = require('lodash');
const numCPUs   = require('os').cpus().length;
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
let settings;

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
async function createAlbum(userId) {
  var album = new models.users.Album();

  album.user = userId;
  album.title = Charlatan.Name.name();
  await album.save();

  let repeat = Charlatan.Helpers.rand(MIN_ALBUM_PHOTOS, MAX_ALBUM_PHOTOS);

  for (let i = 0; i < repeat; i++) {
    await createMedia(userId, album);
  }

  await models.users.Album.updateInfo(album._id, true);
}


// Creates multiple albums
//
// userId - albums owner
//
async function createMultipleAlbums(userId) {
  for (let i = 0; i < ALBUMS_COUNT; i++) {
    await createAlbum(userId);
  }
}


async function createAlbums() {

  let user_ids = [];

  // Collect users from administrators group

  // Get administrators group _id
  let group = await models.users.UserGroup
                      .findOne({ short_name: 'administrators' })
                      .select('_id')
                      .lean(true);

  let users = await models.users.User
                      .find({ usergroups: group._id })
                      .select('_id')
                      .lean(true);

  if (users) {
    user_ids = user_ids.concat(_.map(users, '_id'));
  }

  // Collect moderators in first forum section

      // Fetch all sections
  let sections = await models.forum.Section.getChildren(null, 2);

  let SectionModeratorStore = settings.getStore('section_moderator');

  // sections might not exist if forum seed hasn't been loaded yet
  if (sections.length) {
    let moderators = (await SectionModeratorStore.getModeratorsInfo(sections[0]._id))
                       .filter(moderator => moderator.visible)
                       .map(moderator => moderator._id);

    user_ids = user_ids.concat(moderators);
  }

  user_ids = _.uniq(user_ids.map(String));

  // Create albums for prepared user list
  await Promise.map(user_ids, uid => createMultipleAlbums(uid), { concurrency: numCPUs });
}


// Creates random comments to media
//
function createComment(mediaId, userId) {
  let comment = new models.users.Comment();

  comment.user = userId;
  comment.media_id = mediaId;
  comment.ts = new Date();
  comment.text = Charlatan.Lorem.paragraph(Charlatan.Helpers.rand(1, 2));
  comment.st = statuses.comment.VISIBLE;

  return comment.save();
}


// Creates multiple comments
//
async function createMultipleComments(mediaId, usersId) {
  var commentsCount = Charlatan.Helpers.rand(MIN_COMMENTS, MAX_COMMENTS);

  for (let i = 0; i < commentsCount; i++) {
    await createComment(mediaId, usersId[Charlatan.Helpers.rand(0, usersId.length - 1)]);
  }

  await models.users.MediaInfo.updateOne(
    { media_id: mediaId },
    { $inc: { comments_count: commentsCount } }
  );
}


async function createComments() {

  let results = await models.users.MediaInfo.find().lean(true);

  let usersId = _.uniq(_.map(results, 'user'));
  let mediasId = _.map(results, 'media_id');

  // Create comments for prepared media and user list
  await Promise.map(
    mediasId,
    mid => createMultipleComments(mid, usersId),
    { concurrency: numCPUs }
  );
}


module.exports = async function (N) {
  models   = N.models;
  settings = N.settings;

  await createAlbums();
  await createComments();
};
