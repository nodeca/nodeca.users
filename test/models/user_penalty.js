'use strict';


const Promise = require('bluebird');
const assert  = require('assert');
const co      = require('bluebird-co').co;
const _       = require('lodash');


describe('UserPenalty', function () {
  let config;


  before(function save_current_config() {
    config = _.get(TEST.N.config, 'users.infractions');

    _.set(TEST.N.config, 'users.infractions.penalties', [
      { points: 7, action: 'to_violators', action_data: { days: 7 } },
      { points: 100, action: 'to_banned' }
    ]);
  });


  it('should add user to violators', co.wrap(function* () {
    let violators_group_id = yield TEST.N.models.users.UserGroup.findIdByName('violators');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test1',
      joined_ts: new Date()
    });

    yield user.save();

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 5
    })).save();

    // We need delay because post save hook in model without callback
    yield Promise.delay(100);

    let usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups, user.usergroups);

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 5
    })).save();

    yield Promise.delay(100);

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    yield Promise.delay(100);

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);
  }));


  it('should move to banned after 100 points', co.wrap(function* () {
    let banned_group_id = yield TEST.N.models.users.UserGroup.findIdByName('banned');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test2',
      joined_ts: new Date()
    });

    yield user.save();

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 105
    })).save();

    // We need delay because post save hook in model without callback
    yield Promise.delay(100);

    let usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups, [ banned_group_id ]);
  }));


  it('should expire penalty', co.wrap(function* () {
    let violators_group_id = yield TEST.N.models.users.UserGroup.findIdByName('violators');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test3',
      joined_ts: new Date()
    });

    yield user.save();

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    yield Promise.delay(100);

    let usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);

    // Set expire now
    yield TEST.N.models.users.UserPenalty.update(
      { user: user._id },
      { expire: new Date() }
    );

    // Run task
    yield TEST.N.queue.worker('invalidate_penalties').push();
    yield Promise.delay(600);

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;
    assert.deepStrictEqual(usergroups, [ user.usergroups[0] ]);
  }));


  it('should remove penalty when move from violators to banned', co.wrap(function* () {
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test4',
      joined_ts: new Date()
    });

    yield user.save();

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    yield Promise.delay(100);

    let cnt = yield TEST.N.models.users.UserPenalty
                            .where('user').equals(user._id)
                            .count();

    assert.deepStrictEqual(cnt, 1);

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 100
    })).save();

    yield Promise.delay(100);

    cnt = yield TEST.N.models.users.UserPenalty
                        .where('user').equals(user._id)
                        .count();

    assert.deepStrictEqual(cnt, 0);
  }));


  after(function reset_config() {
    _.set(TEST.N.config, 'users.infractions', config);
  });
});
