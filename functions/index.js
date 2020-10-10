const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./utils/FBAuth');

const {getAllPosts, postOnePost} = require('./handlers/posts');
const {signUp, login, uploadImage} = require('./handlers/users');


//posts routes
app.get('/posts', getAllPosts);
app.post('/post', FBAuth, postOnePost);
app.post('/user/image', FBAuth, uploadImage);

//Sign up route
app.post('/signup', signUp);
//login route
app.post('/login', login);

exports.api = functions.region('europe-west1').https.onRequest(app);