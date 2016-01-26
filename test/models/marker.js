'use strict';


const assert    = require('assert');
const _         = require('lodash');
const ObjectId  = require('mongoose').Types.ObjectId;
const co        = require('co');
const Marker    = TEST.N.models.users.Marker;
const redis     = TEST.N.redis;


let expire;


function randObjectIdByTimestamp(ts) {
  var hexChars = 'abcdef0123456789'.split('');
  var hexSeconds = Math.floor(ts / 1000).toString(16);
  var strId = hexSeconds;

  _.times(16, function () {
    strId += _.sample(hexChars);
  });

  return new ObjectId(strId);
}


describe('Marker', function () {

  before(function () {
    return TEST.N.settings.get('content_read_marks_expire').then(content_read_marks_expire => {
      expire = content_read_marks_expire * 24 * 60 * 60 * 1000;
    });
  });


  describe('.mark()', function () {

    it('should mark', co.wrap(function* () {
      let uid = new ObjectId();
      let cat = new ObjectId();
      let cid = new ObjectId();

      yield Marker.mark(uid, cid, cat, 'test');

      let res = yield redis.zscoreAsync('marker_marks:' + uid, cid);

      assert.strictEqual(+res, +cid.getTimestamp());

      res = yield redis.sismemberAsync('marker_marks_items', uid);

      assert.ok(res);
    }));


    it('should skip old', co.wrap(function* () {
      let uid = new ObjectId();
      let cid = randObjectIdByTimestamp(Date.now() - expire - 1000);
      let cat = new ObjectId();

      yield Marker.mark(uid, cid, cat, 'test');

      let res = yield redis.zscoreAsync('marker_marks:' + uid, cid);

      assert.strictEqual(res, null);
    }));
  });


  it('.markAll() should update cut', co.wrap(function* () {
    let uid = new ObjectId();
    let sid = new ObjectId();
    let now = Date.now();

    yield Marker.markAll(uid, sid);

    let res = yield redis.getAsync('marker_cut:' + uid + ':' + sid);

    assert.ok(now - 1000 <= res && res <= now + 1000);

    res = yield redis.zscoreAsync('marker_cut_updates', uid + ':' + sid);

    assert.ok(now - 1000 <= res && res <= now + 1000);
  }));


  it('.setPos()', co.wrap(function* () {
    let uid = new ObjectId();
    let cid = new ObjectId();
    let cat = new ObjectId();
    let now = Date.now();

    yield Marker.setPos(uid, cid, 6, 6, cat, 'test');
    yield Marker.setPos(uid, cid, 2, 1, cat, 'test');

    let res = yield redis.zscoreAsync('marker_pos_updates', uid + ':' + cid);

    assert.ok(now - 1000 <= res && res <= now + 1000);

    let resJson = yield redis.hgetAsync('marker_pos:' + uid, cid);

    res = JSON.parse(resJson);

    assert.equal(res.current, 2);
    assert.equal(res.max, 6);
  }));


  it('.setPos() - limit position markers', co.wrap(function* () {
    let uid = randObjectIdByTimestamp(Date.now());
    let cat = new ObjectId();
    let query = redis.multi();

    for (let i = 0; i < 2000; i++) {
      query.hset('marker_pos:' + uid, i, JSON.stringify({}));
    }

    yield query.execAsync();

    yield Marker.setPos(uid, 'qqq', 6, 6, cat, 'test');

    let cnt = yield redis.hlenAsync('marker_pos:' + uid);

    assert.equal(cnt, 1000);
  }));


  describe('.info()', function () {

    it('should set `isNew` flag correctly', co.wrap(function* () {
      let uid = new ObjectId();
      let now = Date.now();
      let cat = new ObjectId();

      let sid1 = randObjectIdByTimestamp(now);
      let sid2 = randObjectIdByTimestamp(now);

      let cid1 = randObjectIdByTimestamp(now);
      let cid2 = randObjectIdByTimestamp(now - expire - 1000);
      let cid3 = randObjectIdByTimestamp(now);
      let cid4 = randObjectIdByTimestamp(now);

      yield Marker.mark(uid, cid3, cat, 'test');

      let res = yield Marker.info(uid, [
        { categoryId: sid1, contentId: cid1, lastPostNumber: 1 },
        { categoryId: sid1, contentId: cid2, lastPostNumber: 1 },
        { categoryId: sid1, contentId: cid3, lastPostNumber: 1 },
        { categoryId: sid2, contentId: cid4, lastPostNumber: 1 }
      ]);

      assert.ok(res[cid1].isNew);
      assert.ok(!res[cid2].isNew);
      assert.ok(!res[cid3].isNew);
      assert.ok(res[cid4].isNew);
    }));


    it('should set correct position info', co.wrap(function* () {
      let uid = new ObjectId();
      let now = Date.now();
      let cat = new ObjectId();

      var sid = randObjectIdByTimestamp(now);
      let cid1 = randObjectIdByTimestamp(now);
      let cid2 = randObjectIdByTimestamp(now);
      let cid3 = randObjectIdByTimestamp(now);

      yield Marker.setPos(uid, cid1, 11, 11, cat, 'test');
      yield Marker.setPos(uid, cid1, 7, 7, cat, 'test');
      yield Marker.setPos(uid, cid2, 3, 3, cat, 'test');
      yield Marker.setPos(uid, cid2, 35, 35, cat, 'test');
      yield Marker.setPos(uid, cid3, 3, 3, cat, 'test');
      yield Marker.setPos(uid, cid3, 35, 35, cat, 'test');

      let res = yield Marker.info(uid, [
        { categoryId: sid, contentId: cid1, lastPostNumber: 11, lastPostTs: now },
        { categoryId: sid, contentId: cid2, lastPostNumber: 77, lastPostTs: now },
        { categoryId: sid, contentId: cid3, lastPostNumber: 77, lastPostTs: now - expire - 1000 }
      ]);

      assert.equal(res[cid1].next, -1);
      assert.equal(res[cid1].position, 7);

      assert.equal(res[cid2].next, 36);
      assert.equal(res[cid2].position, 35);

      assert.equal(res[cid3].next, -1);
      assert.equal(res[cid3].position, 35);
    }));
  });


  it('.cleanup()', co.wrap(function* () {
    let now = Date.now();
    let uid = new ObjectId();
    let query = redis.multi();

    query.set('marker_cut:' + uid + ':abc', now);
    query.set('marker_cut:' + uid + ':bcd', now - expire - 1000);
    query.zadd('marker_cut_updates', now, uid + ':abc');
    query.zadd('marker_cut_updates', now - expire - 1000, uid + ':bcd');

    query.zadd('marker_marks:' + uid, now, 'qwe');
    query.zadd('marker_marks:' + uid, now - expire - 1000, 'ewq');
    query.sadd('marker_marks_items', uid);

    query.hset('marker_pos:' + uid, 'fgh', JSON.stringify({ max: 22, current: 11, ts: +now }));
    query.hset('marker_pos:' + uid, 'hgf', JSON.stringify({ max: 33, current: 15, ts: +now }));
    query.zadd('marker_pos_updates', now, uid + ':fgh');
    query.zadd('marker_pos_updates', now - expire - 1000, uid + ':hgf');

    yield query.execAsync();

    yield Marker.cleanup();

    yield new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    query = redis.multi()
      .get('marker_cut:' + uid + ':abc')
      .get('marker_cut:' + uid + ':bcd')
      .zscore('marker_cut_updates', uid + ':abc')
      .zscore('marker_cut_updates', uid + ':bcd')

      .zscore('marker_marks:' + uid, 'qwe')
      .zscore('marker_marks:' + uid, 'ewq')

      .hget('marker_pos:' + uid, 'fgh')
      .hget('marker_pos:' + uid, 'hgf')
      .zscore('marker_pos_updates', uid + ':fgh')
      .zscore('marker_pos_updates', uid + ':hgf');

    let res = yield query.execAsync();

    assert.notEqual(res[0], null);
    assert.equal(res[1], null);
    assert.notEqual(res[2], null);
    assert.equal(res[3], null);

    assert.notEqual(res[4], null);
    assert.equal(res[5], null);

    assert.notEqual(res[6], null);
    assert.equal(res[7], null);
    assert.notEqual(res[8], null);
    assert.equal(res[9], null);
  }));
});
