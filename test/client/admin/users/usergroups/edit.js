'use strict';


/*global $*/


describe('ACP edit user group', function () {
  it('should save changes', function (done) {
    let user;
    let adminGroupId;

    TEST.browser
      .do.auth('admin_users_usergroups_edit', usr => {
        user = usr;
      })
      .fn(cb => {
        TEST.N.models.users.UserGroup.findIdByName('administrators', (err, res) => {
          if (err) {
            cb(err);
            return;
          }
          adminGroupId = res;
          user.usergroups.push(adminGroupId);
          user.save(cb);
        });
      })
      .do.open(() => TEST.N.router.linkTo('admin.users.usergroups.edit', { _id: adminGroupId }))
      .do.click('#setting_can_see_deleted_users')
      .do.click('button.btn-primary[type="submit"]')
      .do.wait('.alert-info')
      .do.reload()
      .test.evaluate(function () {
        return $('#setting_can_see_deleted_users').is(':checked') === false;
      })
      // Set setting back
      .do.click('#setting_can_see_deleted_users')
      .do.click('button.btn-primary[type="submit"]')
      .do.wait('.alert-info')
      .run(true, done);
  });
});
