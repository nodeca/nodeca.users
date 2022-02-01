'use strict';


const _       = require('lodash');
const assert  = require('assert');


describe('UserPenalty', function () {
  let config;


  before(function save_current_config() {
    config = TEST.N.config.users?.infractions;

    _.set(TEST.N.config, 'users.infractions.penalties', [
      { points: 7, action: 'to_violators', action_data: { days: 7 } },
      { points: 100, action: 'to_banned' }
    ]);
  });


  it('should add user to violators', async function () {
    let violators_group_id = await TEST.N.models.users.UserGroup.findIdByName('violators');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test1',
      joined_ts: new Date()
    });

    await user.save();

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 5
    })).save();

    // We need delay because post save hook in model without callback
    await new Promise(resolve => setTimeout(resolve, 100));

    let usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0] ]);

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 5
    })).save();

    await new Promise(resolve => setTimeout(resolve, 100));

    usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    await new Promise(resolve => setTimeout(resolve, 100));

    usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);
  });


  it('should move to banned after 100 points', async function () {
    let banned_group_id = await TEST.N.models.users.UserGroup.findIdByName('banned');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test2',
      joined_ts: new Date()
    });

    await user.save();

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 105
    })).save();

    // We need delay because post save hook in model without callback
    await new Promise(resolve => setTimeout(resolve, 100));

    let usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;

    assert.deepStrictEqual(usergroups, [ banned_group_id ]);
  });


  it('should expire penalty', async function () {
    let violators_group_id = await TEST.N.models.users.UserGroup.findIdByName('violators');
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test3',
      joined_ts: new Date()
    });

    await user.save();

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    // Infraction propagate logic sit on `postsave` hook, wait it.
    await new Promise(resolve => setTimeout(resolve, 100));

    let usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;

    assert.deepStrictEqual(usergroups, [ user.usergroups[0], violators_group_id ]);

    // Set expire now
    await TEST.N.models.users.UserPenalty.updateOne(
      { user: user._id },
      { expire: new Date() }
    );

    // Run task
    let task_id = await TEST.N.queue.invalidate_penalties().run();
    let retries = 100;

    let task = await TEST.N.queue.getTask(task_id);

    while (task.state !== 'finished' && --retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      task = await TEST.N.queue.getTask(task_id);
    }

    if (!retries) throw new Error('Task waiting timeout');

    usergroups = (await TEST.N.models.users.User.findOne({ _id: user._id }).lean(true)).usergroups;
    assert.deepStrictEqual(usergroups, [ user.usergroups[0] ]);
  });


  it('should remove penalty when move from violators to banned', async function () {
    let user = new TEST.N.models.users.User({
      nick: 'userpenalty_test4',
      joined_ts: new Date()
    });

    await user.save();

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 20
    })).save();

    await new Promise(resolve => setTimeout(resolve, 100));

    let cnt = await TEST.N.models.users.UserPenalty
                            .where('user').equals(user._id)
                            .countDocuments();

    assert.deepStrictEqual(cnt, 1);

    await (new TEST.N.models.users.Infraction({
      from: user._id,
      for: user._id,
      type: 'custom',
      reason: 'Custom reason',
      points: 100
    })).save();

    await new Promise(resolve => setTimeout(resolve, 100));

    cnt = await TEST.N.models.users.UserPenalty
                        .where('user').equals(user._id)
                        .countDocuments();

    assert.deepStrictEqual(cnt, 0);
  });


  after(function reset_config() {
    _.set(TEST.N.config, 'users.infractions', config);
  });
});
