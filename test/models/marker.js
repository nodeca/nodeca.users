'use strict';


const _         = require('lodash');
const assert    = require('assert');
const ObjectId  = require('mongoose').Types.ObjectId;
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

    it('should mark', async function () {
      let uid = new ObjectId();
      let cat = new ObjectId();
      let cid = new ObjectId();

      await Marker.mark(uid, cid, cat, 'test');

      let res = await redis.zscoreAsync('marker_marks:' + uid, String(cid));

      assert.strictEqual(+res, +cid.getTimestamp());

      res = await redis.sismemberAsync('marker_marks_items', String(uid));

      assert.ok(res);
    });


    it('should skip old', async function () {
      let uid = new ObjectId();
      let cid = randObjectIdByTimestamp(Date.now() - expire - 1000);
      let cat = new ObjectId();

      await Marker.mark(uid, cid, cat, 'test');

      let res = await redis.zscoreAsync('marker_marks:' + uid, String(cid));

      assert.strictEqual(res, null);
    });
  });


  it('.markAll() should update cut', async function () {
    let uid = new ObjectId();
    let sid = new ObjectId();
    let now = Date.now();

    await Marker.markAll(uid, sid);

    let res = await redis.getAsync('marker_cut:' + uid + ':' + sid);

    assert.ok(now - 1000 <= res && res <= now + 1000);

    res = await redis.zscoreAsync('marker_cut_updates', uid + ':' + sid);

    assert.ok(now - 1000 <= res && res <= now + 1000);
  });


  it('.setPos()', async function () {
    let uid = new ObjectId();
    let cid = new ObjectId();
    let cat = new ObjectId();
    let now = Date.now();

    await Marker.setPos(uid, cid, 6, 6, cat, 'test');
    await Marker.setPos(uid, cid, 2, 1, cat, 'test');

    let res = await redis.zscoreAsync('marker_pos_updates', uid + ':' + cid);

    assert.ok(now - 1000 <= res && res <= now + 1000);

    let resJson = await redis.hgetAsync('marker_pos:' + uid, String(cid));

    res = JSON.parse(resJson);

    assert.equal(res.current, 2);
    assert.equal(res.max, 6);
  });


  it('.setPos() - limit position markers', async function () {
    let uid = randObjectIdByTimestamp(Date.now());
    let cat = new ObjectId();
    let query = redis.multi();

    for (let i = 0; i < 2000; i++) {
      query.hset('marker_pos:' + uid, i, JSON.stringify({}));
    }

    await query.execAsync();

    await Marker.setPos(uid, 'qqq', 6, 6, cat, 'test');

    let cnt = await redis.hlenAsync('marker_pos:' + uid);

    assert.equal(cnt, 1000);
  });


  describe('.info()', function () {

    it('should set `isNew` flag correctly', async function () {
      let uid = new ObjectId();
      let now = Date.now();
      let cat = new ObjectId();

      let sid1 = randObjectIdByTimestamp(now);
      let sid2 = randObjectIdByTimestamp(now);

      let cid1 = randObjectIdByTimestamp(now);
      let cid2 = randObjectIdByTimestamp(now - expire - 1000);
      let cid3 = randObjectIdByTimestamp(now);
      let cid4 = randObjectIdByTimestamp(now);

      await Marker.mark(uid, cid3, cat, 'test');

      let res = await Marker.info(uid, [
        { categoryId: sid1, contentId: cid1, lastPostNumber: 1 },
        { categoryId: sid1, contentId: cid2, lastPostNumber: 1 },
        { categoryId: sid1, contentId: cid3, lastPostNumber: 1 },
        { categoryId: sid2, contentId: cid4, lastPostNumber: 1 }
      ]);

      assert.ok(res[cid1].isNew);
      assert.ok(!res[cid2].isNew);
      assert.ok(!res[cid3].isNew);
      assert.ok(res[cid4].isNew);
    });


    it('should set correct position info', async function () {
      let uid = new ObjectId();
      let now = Date.now();
      let cat = new ObjectId();

      var sid = randObjectIdByTimestamp(now);
      let cid1 = randObjectIdByTimestamp(now);
      let cid2 = randObjectIdByTimestamp(now);
      let cid3 = randObjectIdByTimestamp(now);

      await Marker.setPos(uid, cid1, 11, 11, cat, 'test');
      await Marker.setPos(uid, cid1, 7, 7, cat, 'test');
      await Marker.setPos(uid, cid2, 3, 3, cat, 'test');
      await Marker.setPos(uid, cid2, 35, 35, cat, 'test');
      await Marker.setPos(uid, cid3, 3, 3, cat, 'test');
      await Marker.setPos(uid, cid3, 35, 35, cat, 'test');

      let res = await Marker.info(uid, [
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
    });
  });


  it('.cleanup()', async function () {
    let now = Date.now();
    let uid = new ObjectId();
    let query = redis.multi();

    query.set('marker_cut:' + uid + ':abc', now);
    query.set('marker_cut:' + uid + ':bcd', now - expire - 1000);
    query.zadd('marker_cut_updates', now, uid + ':abc');
    query.zadd('marker_cut_updates', now - expire - 1000, uid + ':bcd');

    query.zadd('marker_marks:' + uid, now, 'qwe');
    query.zadd('marker_marks:' + uid, now - expire - 1000, 'ewq');
    query.sadd('marker_marks_items', String(uid));

    query.hset('marker_pos:' + uid, 'fgh', JSON.stringify({ max: 22, current: 11, ts: +now }));
    query.hset('marker_pos:' + uid, 'hgf', JSON.stringify({ max: 33, current: 15, ts: +now }));
    query.zadd('marker_pos_updates', now, uid + ':fgh');
    query.zadd('marker_pos_updates', now - expire - 1000, uid + ':hgf');

    await query.execAsync();

    await Marker.cleanup();

    await new Promise(resolve => setTimeout(resolve, 100));

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

    let res = await query.execAsync();

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
  });
});
