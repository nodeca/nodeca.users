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
// - `marker_type_cut:<user_id>:<type>`  (key)  - contain timestamp of minimal read cut for all content
//                                                (used as a way to mark everything as read)
// - `marker_type_cut_updates`           (zset) - last update info for `marker_type_cut:*`
//
// GC logic:
//
// - remove old `marker_pos:*` using `marker_pos_updates`
// - remove old `marker_cut:*` using `marker_cut_updates`
// - for each user (stored in `marker_marks_items`) remove old `marker_marks:<user_id>`
//
'use strict';


const _       = require('lodash');


module.exports = function (N, collectionName) {

  let gcHandlers = {};


  function Marker() {
  }


  // Recalculate category cut
  //
  // - userId (ObjectId)
  // - contentId (ObjectId) - id of the topic that triggered gc (used to skip gc at the start of the topic)
  // - categoryId (ObjectId)
  // - type (String) - content type
  // - max (Number) - last read post in topic that triggered gc (used to skip gc at the start of the topic)
  // - currentCut (Number)
  //
  Marker.gc = async function (userId, contentId, categoryId, type, max, currentCut) {
    if (!gcHandlers[type]) return;

    let contentInfo = await gcHandlers[type](userId, contentId, categoryId, max, currentCut);

    if (!contentInfo.length) return;

    contentInfo = _.sortBy(contentInfo, 'lastPostTs');

    let marks = await Marker.info(userId, contentInfo);

    let updatedCut = currentCut;
    let mark;

    for (let item of contentInfo) {
      mark = marks[item.contentId];

      if (mark.isNew || mark.next !== -1) break;

      updatedCut = +item.lastPostTs;
    }

    if (updatedCut !== currentCut) {
      await Marker.markByCategory(userId, categoryId, updatedCut);
    }
  };


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


  // Mark content as read (remove isNew flag from it), mark first post as read
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - categoryId (ObjectId)
  // - type (String) - content type
  //
  Marker.mark = async function (userId, contentId, categoryId, type) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let res = await Marker.cuts(userId, [ categoryId ], type);

    // Don't mark old content
    if (contentId.getTimestamp() < res[categoryId]) return;

    await Promise.all([
      N.redis.sadd('marker_marks_items', String(userId)),
      N.redis.zadd('marker_marks:' + userId, +contentId.getTimestamp(), String(contentId))
    ]);

    // Mark first post as read if marker does not exist
    if (!(await N.redis.hexists('marker_pos:' + userId, String(contentId)))) {
      await Marker.setPos(userId, contentId, categoryId, type, 1, 1);
    }
  };


  // Mark all topics in a specific category before now as read
  //
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - ts (Number) - optional, cut off timestamp, `Date.now()` by default
  //
  Marker.markByCategory = async function (userId, categoryId, ts) {
    if (!userId || String(userId) === '000000000000000000000000') return;

    let now = Date.now();

    if (!ts) ts = now;

    // If `ts` bigger than now plus one hour or more - stop here
    if (ts > 1000 * 60 * 60 + now) return;

    await N.redis.zadd('marker_cut_updates', now, userId + ':' + categoryId);
    await N.redis.set('marker_cut:' + userId + ':' + categoryId, ts);
  };


  // Mark all topics of a specific kind (content type) before now as read
  //
  // - userId (ObjectId)
  // - type (String)
  // - ts (Number) - optional, cut off timestamp, `Date.now()` by default
  //
  Marker.markByType = async function (userId, type, ts) {
    if (!userId || String(userId) === '000000000000000000000000') return;

    let now = Date.now();

    if (!ts) ts = now;

    // If `ts` bigger than now plus one hour or more - stop here
    if (ts > 1000 * 60 * 60 + now) return;

    await N.redis.zadd('marker_type_cut_updates', now, userId + ':' + type);
    await N.redis.set('marker_type_cut:' + userId + ':' + type, ts);
  };


  // Remove extra position markers if user have more than limit
  //
  async function limitPositionMarkers(userId) {
    let maxItems = 1000;
    let gcThreshold = maxItems + Math.round(maxItems * 0.10) + 1;

    // Get position records count
    let cnt = await N.redis.hlen('marker_pos:' + userId);

    // If count less than limit - skip
    if (cnt <= gcThreshold) return Promise.resolve();

    let items = await N.redis.hgetall('marker_pos:' + userId);
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
      .take(Object.values(items).length - maxItems)
      .forEach(item => {
        query.hdel('marker_pos:' + userId, item.id);
        query.zrem('marker_pos_updates', userId + ':' + item.id);
      });

    return query.exec();
  }


  // Set current scroll position in topic
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - categoryId (ObjectId)
  // - type (String) - content type
  // - position (Number) - post number in thread (post hid)
  // - max (Number) - last read post in thread
  //
  Marker.setPos = async function (userId, contentId, categoryId, type, position, max) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let now = Date.now();
    let posJson = await N.redis.hget('marker_pos:' + userId, String(contentId));
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

    await N.redis.zadd('marker_pos_updates', now, userId + ':' + contentId);
    await N.redis.hset('marker_pos:' + userId, String(contentId), JSON.stringify(pos));
    await limitPositionMarkers(userId);

    if (!maxUpdated) return;

    let res = await Marker.cuts(userId, [ categoryId ], type);

    await Marker.gc(userId, contentId, categoryId, type, max, res[categoryId]);
  };


  // Get cuts ts for categories
  //
  // - userId (ObjectId)
  // - categoriesIds ([ObjectId])
  // - type (String)
  //
  // returns (Hash) - key is `categoryId` value is number
  //
  Marker.cuts = async function (userId, categoriesIds, type) {
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

    let content_read_marks_expire = await N.settings.get('content_read_marks_expire');

    let cutKeys = categoriesIds.map(id => 'marker_cut:' + userId + ':' + id);

    let [ typeCut, ...cuts ] = await N.redis.mget(
      [ 'marker_type_cut:' + userId + ':' + type ].concat(cutKeys)
    );

    let defaultCut = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);
    let result = {};

    categoriesIds.forEach((id, i) => {
      result[id] = Math.max(+cuts[i] || defaultCut, typeCut || 0);
    });

    return result;
  };


  // Build content info
  //
  // - userId (ObjectId)
  // - contentInfo ([Object])
  //   - categoryId (ObjectId)
  //   - contentId (ObjectId)
  //   - lastPostNumber (Number) - last post number in thread (post hid)
  //   - lastPostTs (Number)
  // - type (String)
  //
  // returns (Hash) - key is `contentId` value is object
  //
  // - isNew (Boolean) - is topic already opened by user (or older than 30 days)
  // - next (Number) - hid of first unread post in topic or `-1` if not set
  // - position (Number) - last read post position or `-1` if not set
  //
  Marker.info = async function (userId, contentInfo, type) {
    let result = {};

    for (let item of contentInfo) {
      result[item.contentId] = { isNew: false, next: -1, position: -1 };
    }

    if (!userId || String(userId) === '000000000000000000000000' || contentInfo.length === 0) {
      return result;
    }

    // Fetch cuts
    let cuts = await Marker.cuts(userId, contentInfo.map(x => x.categoryId), type);

    // Set `isNew` flag by cut
    for (let item of contentInfo) {
      if (item.contentId.getTimestamp() > cuts[item.categoryId]) {
        result[item.contentId].isNew = true;
      }
    }


    // Unset `isNew` flag by markers
    //
    let newCandidates = [];
    let query = N.redis.multi();

    for (let [ id, v ] of Object.entries(result)) {
      if (v.isNew) {
        query.zscore('marker_marks:' + userId, id);
        newCandidates.push(id);
      }
    }

    let res = await query.exec();

    for (let [ n, id ] of Object.entries(newCandidates)) {
      if (res[n][1] !== null) {
        result[id].isNew = false;
      }
    }


    // Fill position info
    //
    let contentIds = Object.keys(result);
    let max;

    query = N.redis.multi();

    contentIds.forEach(id => query.hget('marker_pos:' + userId, id));

    let posInfo = await query.exec();

    posInfo = posInfo.map(([ , json ]) => {
      let result;

      if (json) {
        try {
          result = JSON.parse(json);
        } catch (__) {}
      }

      return result;
    });

    for (let item of contentInfo) {
      max = posInfo[contentIds.indexOf(String(item.contentId))]?.max ?? -1;
      result[item.contentId].position = posInfo[contentIds.indexOf(String(item.contentId))]?.current ?? -1;

      if (item.lastPostTs < cuts[item.categoryId]) {
        // if last post is old, mark all topic as unread
        result[item.contentId].next = -1;
      } else if (max === -1) {
        // marker doesn't exist in redis, but the last post is recent,
        // set next unread to 1 because we don't know what post is actually last
        result[item.contentId].next = 1;
      } else if (item.lastPostNumber > max) {
        // marker exists, post is recent, so we know next position
        result[item.contentId].next = +max + 1;
      }
    }

    return result;
  };


  // Cleanup deprecated markers (older than 30 days):
  //
  // - remove old `marker_pos:*` using `marker_pos_updates`
  // - remove old `marker_cut:*` using `marker_cut_updates`
  // - for each user (stored in `marker_marks_items`) remove old `marker_marks:<user_id>`
  //
  Marker.cleanup = async function () {
    let content_read_marks_expire = await N.settings.get('content_read_marks_expire');
    let lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);

    // Cleanup position markers
    //
    let posItems = await N.redis.zrangebyscore('marker_pos_updates', '-inf', lastTs);
    let posQuery = N.redis.multi();

    posItems.forEach(item => {
      let parts = item.split(':');

      posQuery.hdel(`marker_pos:${parts[0]}`, parts[1]);
      posQuery.zrem('marker_pos_updates', item);
    });

    await posQuery.exec();


    // Cleanup cut markers
    //
    let cutItems = await N.redis.zrangebyscore('marker_cut_updates', '-inf', lastTs);
    let cutQuery = N.redis.multi();

    cutItems.forEach(item => {
      cutQuery.del('marker_cut:' + item);
      cutQuery.zrem('marker_cut_updates', item);
    });

    await cutQuery.exec();


    // Cleanup type cut markers
    //
    let typeCutItems = await N.redis.zrangebyscore('marker_type_cut_updates', '-inf', lastTs);
    let typeCutQuery = N.redis.multi();

    typeCutItems.forEach(item => {
      typeCutQuery.del('marker_type_cut:' + item);
      typeCutQuery.zrem('marker_type_cut_updates', item);
    });

    await typeCutQuery.exec();


    // Cleanup read markers
    //
    // TODO: cut by script if number of active users per month became too big
    //
    let marksItems = await N.redis.smembers('marker_marks_items');
    let marksQuery = N.redis.multi();

    marksItems.forEach(item => {
      // Drop elements and count the rest
      marksQuery.zremrangebyscore('marker_marks:' + item, '-inf', lastTs);
      marksQuery.zcard('marker_marks:' + item);
    });

    let res = await marksQuery.exec();
    let query = N.redis.multi();

    marksItems.forEach((item, i) => {
      if (res[i * 2 + 1][1] === 0) { // zcard result
        query.srem('marker_marks_items', item);
      }
    });

    await query.exec();
  };


  N.wire.on('init:models', function emit_init_Marker(__, callback) {
    N.wire.emit('init:models.' + collectionName, Marker, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Marker() {
    N.models[collectionName] = Marker;
  });
};
