const {db} = require('../utils/admin');

exports.getAllPosts = (req, res) =>{
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
}

exports.postOnePost = (req, res) =>{
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
};