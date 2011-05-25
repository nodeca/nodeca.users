var mongoose   = require('mongoose'),
    User       = mongoose.model('User'),
    Controller = require('express-railer').Controller;


var UsersController = function UsersController(app) {
  Controller.apply(this);


  this.login = function login_action(req, res, next) {
    if (req.session.user) {
      res.redirect('home_url');
      return;
    }

    if (req.isPost()) {
      var credentials = {
        username: req.params['username'],
        password: req.params['password']
      };

      User.find(credentials, function authenticate(err, users) {
        if (err) {
          next(err);
          return;
        }

        if (1 == users.length) {
          req.session.user = users[0];
          res.redirect('home_url');
          return;
        }

        res.flash('err', 'Login and/or password is invalid');
        res.render('users/login');
      });
      return;
    }

    res.render('users/login');
  };


  this.logout = function logout_action(req, res, next) {
    if (req.session.user) {
      req.session.user = false;
    }

    res.redirect('home_url');
  };
};


Controller.adopts(UsersController).export(module);


// vim:et:ts=2:sw=2
