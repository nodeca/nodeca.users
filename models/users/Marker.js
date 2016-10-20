// Content marker for forum topic lists, blog entries and so on
//
// Redis data:
//
// - `marker_marks:<user_id>`            (zset) - contain `_id` of read content and timestamp as score
// - `marker_marks_items`                (set)  - `user_id` list, used to search all `marker_marks:*` sets
// - `marker_pos:<user_id>`              (hash) - content position
//   - <content_id> (JSON)
//     - `current`
//     - `max` - last read
//     - `ts` - last update
// - `marker_pos_updates`                (zset) - last update info for `marker_pos:*`
// - `marker_cut:<user_id>:<section_id>` (key)  - contain timestamp of read cut
// - `marker_cut_updates`                (zset) - last update info for `marker_cut:*`
//
// GC logic:
//
// - remove old `marker_pos:*` using `marker_pos_updates`
// - remove old `marker_cut:*` using `marker_cut_updates`
// - for each user (stored in `marker_marks_items`) remove old `marker_marks:<user_id>`
//
'use strict';


const Promise = require('bluebird');
const _       = require('lodash');


module.exports = function (N, collectionName) {

  let gcHandlers = {};


  function Marker() {
  }


  // Recalculate category cut
  //
  // - type (String) - content type
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - currentCut (Number)
  //
  Marker.gc = Promise.coroutine(function* (type, userId, categoryId, currentCut) {
    if (!gcHandlers[type]) return;

    let contentInfo = yield gcHandlers[type](userId, categoryId, currentCut);

    if (!contentInfo.length) return;

    contentInfo = _.sortBy(contentInfo, 'lastPostTs');

    let marks = yield Marker.info(userId, contentInfo);

    let updatedCut = currentCut;
    let mark;

    for (let i = 0; i < contentInfo.length; i++) {
      mark = marks[contentInfo[i].contentId];

      if (mark.isNew || mark.next !== -1) break;

      updatedCut = +contentInfo[i].lastPostTs;
    }

    if (updatedCut !== currentCut) {
      yield Marker.markAll(userId, categoryId, updatedCut);
    }
  });


  // Add handler to load content data for `.gc()`
  //
  // - type (String) - content type
  // - handler (Function) - `function (userId, categoryId, currentCut, callback)`
  //   - userId (ObjectId)
  //   - categoryId (ObjectId)
  //   - currentCut (Number)
  //   - callback (Function) - `function (err, contentInfo)`
  //     - err
  //     - contentInfo ([Object])
  //       - contentId (ObjectId)
  //       - categoryId (ObjectId)
  //       - lastPostNumber (Number) - last post number in thread (post hid)
  //       - lastPostTs (Number)
  //
  Marker.registerGc = function (type, handler) {
    gcHandlers[type] = handler;
  };


  // Mark content as read
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - categoryId (ObjectId)
  // - type (String) - content type
  //
  Marker.mark = Promise.coroutine(function* (userId, contentId, categoryId, type) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let res = yield Marker.cuts(userId, [ categoryId ]);

    // Don't mark old content
    if (contentId.getTimestamp() < res[categoryId]) return;

    yield Promise.all([
      N.redis.saddAsync('marker_marks_items', String(userId)),
      N.redis.zaddAsync('marker_marks:' + userId, +contentId.getTimestamp(), String(contentId))
    ]);
    yield Marker.gc(type, userId, categoryId, res[categoryId]);
  });


  // Mark all topics before now as read
  //
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - ts (Number) - optional, cut off timestamp, `Date.now()` by default
  //
  Marker.markAll = Promise.coroutine(function* (userId, categoryId, ts) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let now = Date.now();

    if (!ts) {
      ts = now;
    }

    // If `ts` bigger than now plus one hour or more - stop here
    if (ts > 1000 * 60 * 60 + Date.now()) return;

    yield N.redis.zaddAsync('marker_cut_updates', now, userId + ':' + categoryId);
    yield N.redis.setAsync('marker_cut:' + userId + ':' + categoryId, ts);
  });


  // Remove extra position markers if user have more than limit
  //
  const limitPositionMarkers = Promise.coroutine(function* (userId) {
    let maxItems = 1000;
    let gcThreshold = maxItems + Math.round(maxItems * 0.10) + 1;

    // Get position records count
    let cnt = yield N.redis.hlenAsync('marker_pos:' + userId);

    // If count less than limit - skip
    if (cnt <= gcThreshold) return Promise.resolve();

    let items = yield N.redis.hgetallAsync('marker_pos:' + userId);
    let query = N.redis.multi();

    _(items)
      .mapValues((json, id) => {
        let result = { ts: -1 };

        if (json) {
          try {
            result = JSON.parse(json);
          } catch (__) {}
        }

        result.id = id;

        return result;
      })
      .sortBy('ts')
      .take(_.values(items).length - maxItems)
      .forEach(item => {
        query.hdel('marker_pos:' + userId, item.id);
        query.zrem('marker_pos_updates', userId + ':' + item.id);
      });

    return query.execAsync();
  });


  // Set current scroll position in topic
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - position (Number) - post number in thread (post hid)
  // - max (Number) - last read post in thread
  // - categoryId (ObjectId)
  // - type (String) - content type
  //
  Marker.setPos = Promise.coroutine(function* (userId, contentId, position, max, categoryId, type) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let now = Date.now();
    let posJson = yield N.redis.hgetAsync('marker_pos:' + userId, String(contentId));
    let pos;
    let maxUpdated = false;

    if (posJson) {
      try {
        pos = JSON.parse(posJson);
      } catch (__) {}
    }

    pos = pos || { max: 1, current: position, ts: +now };

    pos.current = position;
    pos.ts = +now;

    if (pos.max < max) {
      pos.max = max;
      maxUpdated = true;
    }

    yield N.redis.zaddAsync('marker_pos_updates', now, userId + ':' + contentId);
    yield N.redis.hsetAsync('marker_pos:' + userId, String(contentId), JSON.stringify(pos));
    yield limitPositionMarkers(userId);

    if (!maxUpdated) return;

    let res = yield Marker.cuts(userId, [ categoryId ]);

    yield Marker.gc(type, userId, categoryId, res[categoryId]);
  });


  // Get cuts ts for categories
  //
  // - userId (ObjectId)
  // - categoriesIds ([ObjectId])
  //
  // returns (Hash) - key is `categoryId` value is number
  //
  Marker.cuts = Promise.coroutine(function* (userId, categoriesIds) {
    if (categoriesIds.length === 0) {
      return [];
    }

    if (!userId || String(userId) === '000000000000000000000000') {
      let now = Date.now();

      return categoriesIds.reduce((acc, id) => {
        acc[String(id)] = now;
        return acc;
      }, {});
    }

    let content_read_marks_expire = yield N.settings.get('content_read_marks_expire');

    let defaultCut = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);
    let result = categoriesIds.reduce((acc, id) => {
      acc[String(id)] = defaultCut;
      return acc;
    }, {});

    let cutKeys = Object.keys(result).map(id => 'marker_cut:' + userId + ':' + id);

    let res = yield N.redis.mgetAsync(cutKeys);

    Object.keys(result).forEach((id, i) => {
      result[id] = +res[i] || defaultCut;
    });

    return result;
  });


  // Build content info
  //
  // - userId (ObjectId)
  // - contentInfo ([Object])
  //   - categoryId (ObjectId)
  //   - contentId (ObjectId)
  //   - lastPostNumber (Number) - last post number in thread (post hid)
  //   - lastPostTs (Number)
  //
  // returns (Hash) - key is `contentId` value is object
  //
  // - isNew (Boolean) - is topic already opened by user (or older than 30 days)
  // - next (Number) - hid of first unread post in topic or `-1` if not set
  // - position (Number) - last read post position or `-1` if not set
  //
  Marker.info = Promise.coroutine(function* (userId, contentInfo) {
    let result = {};

    contentInfo.forEach(item => {
      result[item.contentId] = { isNew: false, next: -1, position: -1 };
    });

    if (!userId || String(userId) === '000000000000000000000000' || contentInfo.length === 0) {
      return result;
    }

    // Fetch cuts
    let cuts = yield Marker.cuts(userId, _.map(contentInfo, 'categoryId'));

    // Set `isNew` flag by cut
    contentInfo.forEach(item => {
      if (item.contentId.getTimestamp() > cuts[item.categoryId]) {
        result[item.contentId].isNew = true;
      }
    });


    // Unset `isNew` flag by markers
    //
    let newCandidates = [];
    let query = N.redis.multi();

    _.forEach(result, (v, id) => {
      if (v.isNew) {
        query.zscore('marker_marks:' + userId, id);
        newCandidates.push(id);
      }
    });

    let res = yield query.execAsync();

    _.forEach(newCandidates, (id, n) => {
      if (res[n] !== null) {
        result[id].isNew = false;
      }
    });


    // Fill position info
    //
    let contentIds = _.keys(result);
    let max;

    query = N.redis.multi();

    contentIds.forEach(id => query.hget('marker_pos:' + userId, id));

    let posInfo = yield query.execAsync();

    posInfo = posInfo.map(json => {
      let result;

      if (json) {
        try {
          result = JSON.parse(json);
        } catch (__) {}
      }

      return result;
    });

    _.forEach(contentInfo, item => {
      max = (posInfo[contentIds.indexOf(String(item.contentId))] || {}).max || -1;
      result[item.contentId].position = (posInfo[contentIds.indexOf(String(item.contentId))] || {}).current || -1;

      if (max === -1 || item.lastPostTs < cuts[item.categoryId]) {
        result[item.contentId].next = -1;
      } else if (item.lastPostNumber > max) {
        result[item.contentId].next = +max + 1;
      }
    });

    return result;
  });


  // Cleanup deprecated markers (older than 30 days):
  //
  // - remove old `marker_pos:*` using `marker_pos_updates`
  // - remove old `marker_cut:*` using `marker_cut_updates`
  // - for each user (stored in `marker_marks_items`) remove old `marker_marks:<user_id>`
  //
  Marker.cleanup = Promise.coroutine(function* () {
    let content_read_marks_expire = yield N.settings.get('content_read_marks_expire');
    let lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);

    // Cleanup position markers
    //
    let posItems = yield N.redis.zrangebyscoreAsync('marker_pos_updates', '-inf', lastTs);
    let posQuery = N.redis.multi();

    posItems.forEach(item => {
      let parts = item.split(':');

      posQuery.hdel(`marker_pos:${parts[0]}`, parts[1]);
      posQuery.zrem('marker_pos_updates', item);
    });

    yield posQuery.execAsync();


    // Cleanup cut markers
    //
    let cutItems = yield N.redis.zrangebyscoreAsync('marker_cut_updates', '-inf', lastTs);
    let cutQuery = N.redis.multi();

    cutItems.forEach(item => {
      cutQuery.del('marker_cut:' + item);
      cutQuery.zrem('marker_cut_updates', item);
    });

    yield cutQuery.execAsync();


    // Cleanup read markers
    //
    // TODO: cut by script if number of active users per month became too big
    //
    let marksItems = yield N.redis.smembersAsync('marker_marks_items');
    let marksQuery = N.redis.multi();

    marksItems.forEach(item => {
      // Drop elements and count the rest
      marksQuery.zremrangebyscore('marker_marks:' + item, '-inf', lastTs);
      marksQuery.zcard('marker_marks:' + item);
    });

    let res = yield marksQuery.execAsync();
    let query = N.redis.multi();

    marksItems.forEach((item, i) => {
      if (res[i * 2 + 1] === 0) { // zcard result
        query.srem('marker_marks_items', item);
      }
    });

    yield query.execAsync();
  });


  N.wire.on('init:models', function emit_init_Marker(__, callback) {
    N.wire.emit('init:models.' + collectionName, Marker, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Marker() {
    N.models[collectionName] = Marker;
  });
};
