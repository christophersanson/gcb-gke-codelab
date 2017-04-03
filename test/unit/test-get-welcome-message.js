const assert = require('assert')
const getWelcomeMsg = require('../../app/lib/get-welcome-message')

exports.it_should_return_welcome_msg = (done) => {
  const welcomeMsg = getWelcomeMsg()
  assert.ok(welcomeMsg === 'Hello World!')
  return done()
};
