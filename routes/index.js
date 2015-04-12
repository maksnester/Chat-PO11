var checkAuth = require('middleware/checkAuth');

module.exports = function(app) {

  app.get('/', require('./frontpage').get);

  app.get('/login', require('./login').get);
  app.post('/login', require('./login').post);

  app.post('/logout', require('./logout').post);

  app.get('/chat/rooms', checkAuth, require('./chat').getUserRooms);
  app.get('/chat', checkAuth, require('./chat').get);

  app.get('/account', checkAuth, require('./account').get);

};
