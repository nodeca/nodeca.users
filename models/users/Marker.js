// Content marker for forum topic lists, blog entries and so on
//
// Redis keys:
//
// - `marker_cut:<user_id>:<section_id>` (key) - contain timestamp of read cut
// - `marker_marks:<user_id>` (zset) - contain `_id` of read content and timestamp as index
// - `marker_pos:<user_id>` (hash) - content postinion
//   - <content_id> (JSON)
//     - `current`
//     - `max` - last read
//     - `ts` - last update
// - `marker_pos_updates` (zset) - last update info for `marker_pos:*`
// - `marker_cut_updates` (zset) - last update info for `marker_cut:*`
// - `marker_marks_items` (set) - items list for `marker_marks:*`
//
'use strict';


const _  = require('lodash');
const co = require('bluebird-co').co;


module.exports = function (N, collectionName) {

  var gcHandlers = {};


  function Marker() {
  }


  // Recalculate category cut
  //
  // - type (String) - content type
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - currentCut (Number)
  //
  Marker.gc = co.wrap(function* (type, userId, categoryId, currentCut) {
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
  Marker.mark = co.wrap(function* (userId, contentId, categoryId, type) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    let res = yield Marker.cuts(userId, [ categoryId ]);

    // Don't mark old content
    if (contentId.getTimestamp() < res[categoryId]) return;

    yield [
      N.redis.saddAsync('marker_marks_items', String(userId)),
      N.redis.zaddAsync('marker_marks:' + userId, +contentId.getTimestamp(), String(contentId))
    ];
    yield Marker.gc(type, userId, categoryId, res[categoryId]);
  });


  // Mark all topics before now as read
  //
  // - userId (ObjectId)
  // - categoryId (ObjectId)
  // - ts (Number) - optional, cut off timestamp, `Date.now()` by default
  //
  Marker.markAll = co.wrap(function* (userId, categoryId, ts) {
    if (!userId || String(userId) === '000000000000000000000000') {
      return;
    }

    var now = Date.now();

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
  function limitPositionMarkers(userId, callback) {
    var maxItems = 1000;
    var gcThreshold = maxItems + Math.round(maxItems * 0.10) + 1;

    // Get position records count
    N.redis.hlen('marker_pos:' + userId, function (err, cnt) {
      if (err) {
        callback(err);
        return;
      }

      // If count less than limit - skip
      if (cnt <= gcThreshold) {
        callback();
        return;
      }

      N.redis.hgetall('marker_pos:' + userId, function (err, items) {
        if (err) {
          callback(err);
          return;
        }

        var query = N.redis.multi();

        _(items)
          .mapValues(function (json, id) {
            var result = { ts: -1 };

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
          .forEach(function (item) {
            query.hdel('marker_pos:' + userId, item.id);
            query.zrem('marker_pos_updates', userId + ':' + item.id);
          });

        query.exec(callback);
      });
    });
  }


  // Set current scroll position in topic
  //
  // - userId (ObjectId)
  // - contentId (ObjectId)
  // - position (Number) - post number in thread (post hid)
  // - max (Number) - last read post in thread
  // - categoryId (ObjectId)
  // - type (String) - content type
  //
  Marker.setPos = co.wrap(function* (userId, contentId, position, max, categoryId, type) {
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

    pos = pos || { max, current: position, ts: +now };

    pos.current = position;
    pos.ts = +now;

    if (pos.max < max) {
      pos.max = max;
      maxUpdated = true;
    }

    yield N.redis.zaddAsync('marker_pos_updates', now, userId + ':' + contentId);
    yield N.redis.hsetAsync('marker_pos:' + userId, String(contentId), JSON.stringify(pos));

    yield new Promise((resolve, reject) => {
      limitPositionMarkers(userId, err => {
        if (err) reject(err);
        else resolve();
      });
    });

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
  Marker.cuts = co.wrap(function* (userId, categoriesIds) {
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
  Marker.info = co.wrap(function* (userId, contentInfo) {
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


  // Cleanup deprecated markers (older than 30 days)
  //
  // - callback (Function) - `function (err)`
  //
  Marker.cleanup = co.wrap(function* () {
    let content_read_marks_expire = yield N.settings.get('content_read_marks_expire');
    let lastTs = Date.now() - (content_read_marks_expire * 24 * 60 * 60 * 1000);

    // Here could be `async.parallel` but we don't need callbacks


    // Cleanup position markers
    //
    N.redis.zrangebyscore('marker_pos_updates', '-inf', lastTs, (err, items) => {
      if (err) return;

      let query = N.redis.multi();

      items.forEach(item => {
        let parts = item.split(':');

        query.hdel('marker_pos:' + parts[0], parts[1]);
        query.zrem('marker_pos_updates', item);
      });

      query.exec();
    });


    // Cleanup cut markers
    //
    N.redis.zrangebyscore('marker_cut_updates', '-inf', lastTs, (err, items) => {
      if (err) return;

      let query = N.redis.multi();

      items.forEach(item => {
        query.del('marker_cut:' + item);
        query.zrem('marker_cut_updates', item);
      });

      query.exec();
    });


    // Cleanup read markers
    //
    N.redis.smembers('marker_marks_items', (err, items) => {
      if (err) return;

      let query = N.redis.multi();

      items.forEach(function (item) {
        query.zremrangebyscore('marker_marks:' + item, '-inf', lastTs);
        query.zcard('marker_marks:' + item);
      });

      query.exec((err, res) => {
        if (err) return;

        let query = N.redis.multi();

        items.forEach((item, i) => {
          if (res[i * 2 + 1] === 0) {
            query.srem('marker_marks_items', item);
          }
        });

        query.exec();
      });
    });
  });


  N.wire.on('init:models', function emit_init_Marker(__, callback) {
    N.wire.emit('init:models.' + collectionName, Marker, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_Marker() {
    N.models[collectionName] = Marker;
  });
};
