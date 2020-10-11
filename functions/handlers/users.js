const {admin, db} = require('../utils/admin');

const config = require('../utils/config');

const firebase = require('firebase');
firebase.initializeApp(config);

const {validateSignupData, validateLoginData, reduceUserDetails} = require('../utils/validators');



exports.signUp = (req, res)=>{
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };
    const {valid, errors} = validateSignupData(newUser);

    if(!valid) return res.status(400).json(errors);

    const noImg = 'puffer-no-img.jpg'

//validate data
    let token, userId;
    db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
        if (doc.exists){
            return res.status(400).json({handle:'The User already exists'});
        }   else {
            return firebase
            .auth()
            .createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
    })
    .then((data) =>{
        userId = data.user.uid;
        return data.user.getIdToken();
    })
    .then((idToken) => {
        token = idToken;
       const userCredentials = {
           handle: newUser.handle,
           email:newUser.email,
           createdAt: new Date().toISOString(),
           imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
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

};

exports.login = (req, res)=>{
    const user = {
        email:req.body.email,
        password:req.body.password
    };

    const {valid, errors} = validateLoginData(user);

    if(!valid) return res.status(400).json(errors);

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
};
//add user details
exports.updateUserDetails = (req, res)=>{
    let userDetails = reduceUserDetails(req.body);
    db.doc(`/users/${req.user.handle}`)
    .update(userDetails)
    .then(()=>{
        return res.json({message:"User Profile update succesfuly"});
    })
    .catch((err)=>{
        console.error(err);
        return res.status(400).json({error:err.code});
    });
};

//get your own user details
exports.getAuthenticatedUser = (res, req) =>{
let resData = {};
db.doc(`/users/${req.user.handle}`).get()
.then(doc =>{
    if(doc.exists){
        resData.credentials = doc.data();
        return db.listCollections('likes').where('userHandle', '==', req.user.handle).get()
    }
    
})
}


//Upload an image
exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({headers: req.headers});

    let imageFilename;
    let imageToBeUploaded = {};

    busboy.on('file', (fieldname, file, filename, encoding, mimetype)=>{
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png'){
            return res.status(400).json({error: 'Wrong File Type'})
        }
        //get the extension of the file like PNG/JPG
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        //After i got the extension i give it a random name
        imageFilename = `${Math.round(Math.random()*1000000000)}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFilename);
        imageToBeUploaded = { filepath, mimetype};
        file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on('finish', ()=>{
        admin
        .storage()
        .bucket()
        .upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata:{
                    contentType:imageToBeUploaded.mimetype
                }
            }
        })
        .then(()=>{
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media`;
            return db.doc(`/users/${req.user.handle}`).update({imageUrl})
        })
        .then(()=>{
            return res.json({message:'Image uploaded succesfuly'});
        }).catch(err=>{
            return res.status(400).json(err, "image Not Uploaded");
            console.log(err);
        });
    });
    busboy.end(req.rawBody);
}