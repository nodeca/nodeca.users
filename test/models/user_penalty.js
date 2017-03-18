'use strict';


const _       = require('lodash');
const assert  = require('assert');
const Promise = require('bluebird');


describe('UserPenalty', function () {
  let config;


  before(function save_current_config() {
    config = _.get(TEST.N.config, 'users.infractions');

    _.set(TEST.N.config, 'users.infractions.penalties', [
      { points: 7, action: 'to_violators', action_data: { days: 7 } },
      { points: 100, action: 'to_banned' }
    ]);
  });


  it('should add user to violators', Promise.coroutine(function* () {
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

    assert.deepStrictEqual(usergroups.toObject(), user.usergroups.toObject());

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 5
    })).save();

    yield Promise.delay(100);

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups.toObject(), [ user.usergroups[0], violators_group_id ]);

    yield (new TEST.N.models.users.Infraction({
      from: user._id,
      'for': user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    yield Promise.delay(100);

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups.toObject(), [ user.usergroups[0], violators_group_id ]);
  }));


  it('should move to banned after 100 points', Promise.coroutine(function* () {
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

    assert.deepStrictEqual(usergroups.toObject(), [ banned_group_id ]);
  }));


  it('should expire penalty', Promise.coroutine(function* () {
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

    // Infraction propagate logic sit on `postsave` hook, wait it.
    yield Promise.delay(1000);

    let usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;

    assert.deepStrictEqual(usergroups.toObject(), [ user.usergroups[0], violators_group_id ]);

    // Set expire now
    yield TEST.N.models.users.UserPenalty.update(
      { user: user._id },
      { expire: new Date() }
    );

    // Run task
    let task_id = yield TEST.N.queue.invalidate_penalties().run();
    let retries = 100;

    let task = yield TEST.N.queue.getTask(task_id);

    while (task.state !== 'finished' && --retries > 0) {
      yield Promise.delay(100);
      task = yield TEST.N.queue.getTask(task_id);
    }

    if (!retries) throw new Error('Task waiting timeout');

    usergroups = (yield TEST.N.models.users.User.findOne({ _id: user._id })).usergroups;
    assert.deepStrictEqual(usergroups.toObject(), [ user.usergroups[0] ]);
  }));


  it('should remove penalty when move from violators to banned', Promise.coroutine(function* () {
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
