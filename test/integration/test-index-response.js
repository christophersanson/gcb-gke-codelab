const supertest = require('supertest')
const assert = require('assert')
const app = require('../../app/app')

exports.index_should_respond = function(done){
  supertest(app)
  .get('/')
  .expect(200)
  .end(function (err, response) {
  	assert.ok(!err);
  	assert.ok(response.body === 'Hello World!')
  	return done();
  });
};
