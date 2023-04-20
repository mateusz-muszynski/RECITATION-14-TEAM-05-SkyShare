// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });

  // ===========================================================================
  // TO-DO: Part A Login unit test case


// 13. Write 2 test cases for the /login API in your website.

// log in: POSITIVE CASE!!!!!!
  // Checking POST /login API by passing the valid username,passsword 
  // this test case should pass and redirect the user to the home page.
const url = require('url');
const expect = chai.expect;

describe('POST /login', () => {
  it('POSITIVE login: returns valid login', (done) => {
    chai.request(server)
      .post('/login')
      .send({ username: 'hey', password: 'heyy' }) // heyy hashes to $2b$10$4uR6kATzuF5J0u/ctkwmW.z622k//E4lF7RNc7c5FHMAx9ESp1Fxe
      .end((err, res) => {
       // console.log(res);
       expect(res).to.have.status(200);
       expect(res.body.status).to.equals('success');
       assert.strictEqual(res.body.message, 'validlogin');
       done();
      });
  });
});
  


// log in: NEGATIVE CASE!!!!!!
  // Checking POST /login API by passing an invalid username,passsword.
  // This test case should pass and redirect to the register page so the user can register
describe('POST /login', () => {
  it('NEGATIVE login: returns invalid login', (done) => {
    chai.request(server)
      .post('/login')
      .send({ username: 'invalidddd', password: 'invalidddd' }) // these dont exist in database
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('notsuccess');
        assert.strictEqual(res.body.message, 'invalidlogin');
        done();
      });
  });
});




// part B
// "Write two additional unit test cases (1 positive and 1 negative) for any of the API endpoints, apart from login, in your project."
// writeup says we can write test cases for any api other than login, so here are two test cases for register

// part B: register
describe('POST /register', () => {
  it('POSITIVE register: returns valid registration', (done) => {
    chai.request(server)
      .post('/register')
      .send({ username: 'hey123', password: 'heyy' }) // 
      .end((err, res) => {
       // console.log(res);
       expect(res).to.have.status(200);
       expect(res.body.status).to.equals('success');
       assert.strictEqual(res.body.message, 'validregister');
       done();
      });
  });
});


describe('POST /register', () => {
  it('NEGATIVE regsiter: returns invalid registration', (done) => {
    chai.request(server)
      .post('/register')
      .send({ username: '', password: 'heyy' }) // cannot register an empty username
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('notsuccess');
        assert.strictEqual(res.body.message, 'invalidregister');
        done();
      });
  });
});   
 // hello
});