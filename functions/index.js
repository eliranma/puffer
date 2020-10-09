const  admin  = require('firebase-admin');
const functions = require('firebase-functions');
const app = require('express')();
const firebase = require('firebase');
admin.initializeApp();

const config = {
    apiKey: "AIzaSyDAhDoHGkEiDBOp6T6I4su9EV31pKK3LH4",
    authDomain: "puffer-420-il.firebaseapp.com",
    databaseURL: "https://puffer-420-il.firebaseio.com",
    projectId: "puffer-420-il",
    storageBucket: "puffer-420-il.appspot.com",
    messagingSenderId: "1090910376545",
    appId: "1:1090910376545:web:0a4216a2f8ac3552065020",
    measurementId: "G-44JWCXHPQ0"
  };



  firebase.initializeApp(config);


const db =  admin.firestore();

app.get('/posts', (req, res) =>{
    db.collection('posts')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data =>{
        let posts = [];
        data.forEach(doc =>{
            posts.push({
                postId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt:doc.data().createdAt
            });
        });
        return res.json(posts);
    })
    .catch((err) => console.log(err));
});

const FBAuth = (req, res, next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken = req.headers.authorization.split('Bearer ')[1];
    }   else {
        console.error('No token found')
        return res.status(403).json({error: 'Unauthorized'});
    }
    admin.auth().verifyIdToken(idToken)
    .then((decodedToken) =>{
        req.user = decodedToken;
        console.log(decodedToken);
        return db.collection('users')
        .where('userId', '==', req.user.uid)
        .limit(1)
        .get();
    })
    .then(data =>{
        req.user.handle = data.docs[0].data().handle;
        return next();
    })
    .catch(err => {
        console.error('Error while trying to verify');
    })
}

app.post('/post', FBAuth, (req, res) =>{
    if(req.body.body.trim() === ''){
        return res.status(400).json({body:'Cant send empty Post'});
    }
    const newPost = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        userHandle: req.user.handle
    };
    db.collection('posts')
    .add(newPost)
    .then(doc =>{
        res.json({ message: `${doc.id} created Succesfully`});
    })
    .catch(err =>{
        res.status(500).json({error: `error ${err}`});
    });
});

const isEmpty = (str) =>{
    if(str.trim() === '')
    return true;
    else return false;
}
const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx))
    return true;
    else return false;
}

//Sign up route
app.post('/signup', (req, res)=>{
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPaswword: req.body.confirmPassword,
        handle: req.body.handle
    };
    let errors = {};

    if(isEmpty(newUser.email)){
        errors.email = 'Email must not be empty'
    }   else if(!isEmail(newUser.email)){
        errors.email = "Must be a valid email address"
    }

    if(isEmpty(newUser.password)) errors.password = 'Must not be empty';
    if(newUser.password !== newUser.confirmPassword ) errors.confirmPassword = 'Passwords must be match';
    if(isEmpty(newUser.handle)) errors.handle = 'Must not be empty';

    if(Object.keys(errors).length > 0 ) return res.status(400).json(`${errors}`);

//validate data
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
    .then(doc => {
        if (doc.exists){
            return res.status(400).json({handle:'The User already exists'});
        }   else {
            return firebase
            .auth()
            .createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
    })
    .then(data =>{
        userId = data.user.uid;
        return data.user.getIdToken();
    })
    .then((tokenId) => {
        token = tokenId
       const userCredentials = {
           handle: newUser.handle,
           email:newUser.email,
           createdAt: new Date().toISOString(),
           userId
       };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(()=>{
        return res.json(201).json({token})
    })
    .catch(err => {
        console.error(err);
        if (err.code === 'auth/email-already-in-use'){
            return res.status(400).json({email: 'Email is already in use'});
        }   else {
            return res.status(500).json({error:err.code});
        }
    })

});


app.post('/login',(req, res)=>{
    const user = {
        email:req.body.email,
        password:req.body.password
    };
    let errors = {};

    if(isEmpty(user.password)) errors.password = 'Must not be empty';
    if(isEmpty(user.email)) errors.email = 'Must not be empty';

    if(Object.keys(errors).length > 0) return  res.status(400).json(errors);
    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
    .then(data =>{
        return data.user.getIdToken();
    })
    .then((token) => {
        return res.json({token});
    })
    .catch((err) => {
        console.error(err);
        if (err.code === 'auth/wrong-password'){
            return res.status(403).json({general: 'Wrong Password, Access denied, Please try again'});
        }   else 
        return res.status(500).json({error: err.code});
    });
})

exports.api = functions.region('europe-west1').https.onRequest(app);