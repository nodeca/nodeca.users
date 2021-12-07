'use strict';


/*global $*/


describe('ACP edit user group', function () {
  it('should save changes', async () => {
    let user;
    let adminGroupId;

    await TEST.browser
      .do.auth('admin_users_usergroups_edit', usr => {
        user = usr;
      })
      .fn(() => TEST.N.models.users.UserGroup.findIdByName('administrators')
                  .then(res => {
                    adminGroupId = res;
                    user.usergroups.push(adminGroupId);
                    return user.save();
                  })
      )
      .do.open(() => TEST.N.router.linkTo('admin.users.usergroups.edit', { _id: adminGroupId }))
      .do.click('#setting_can_see_deleted_users')
      .do.click('button.btn-primary[type="submit"]')
      .do.wait('.notification-info')
      .do.reload()
      .test.evaluate(function () {
        return $('#setting_can_see_deleted_users').is(':checked') === false;
      })
      // Set setting back
      .do.click('#setting_can_see_deleted_users')
      .do.click('button.btn-primary[type="submit"]')
      .do.wait('.notification-info')
      .close();
  });
});
