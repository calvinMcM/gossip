var express = require('express');
var app = express();
var session = require('express-session')

// Body Parsing.
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(session({secret: 'hehehehe'}));

// UUID Library support at https://www.npmjs.com/package/node-uuid
var uuid = require('node-uuid');

// Credentials
var credentials = {};

// Users
var userDatas = {};

// Message Reception Logic

function workQueue(want){
    if(!isWant(want)){ return; }
    this.queue = [];
    var work = want.Want;
    for(var unit of work){
        this.queue.push({uuid:unit,index:work[unit]);
    }
}

workQueue.prototype = {

    /**
     * Returns an object of form {uuid,index} that can be processed.
     */
    pop: function(){
        if(!this.isEmpty()){
            return this.queue.shift();
        }
    },

    /**
     * Returns a boolean condition about whether or not the queue is empty.
     */
    isEmpty: function(){
        return !this.queue.length;
    }
}

function isRumor(message){
    return message.hasOwnProperty("Rumor");
}

function isWant(message){
    return message.hasOwnProperty("Want");
}

// User data storage

function userData(uuid, credentials, messageIndex, messages, state, peers){
    this.uuid = uuid;
    this.username = credentials.username;
    this.password = credentials.password;
    this.messages = messages;
    this.state = state;
    this.peers = peers;

    if(!this.state.hasOwnProperty(uuid) || this.state[uuid] < messageIndex){
        this.state[uuid] = messageIndex;
    }
}

userData.prototype = {
    storeMessage: function(message){
        if(isRumor(message)){
            var body = message.Rumor;
            console.log("Mess:",message,message.Rumor);
            var m_id = body.MessageID;
            var m_parts = m_id.split(":");
            var m_uuid = m_parts[0];
            var m_num = m_parts[1];
            if(!this.messages.hasOwnProperty(m_uuid){
                this.messages[m_uuid] = {};
            }
            this.messages[m_uuid][m_num] = message;

            // Update state message index tracker
            if(!state.hasOwnProperty(m_uuid) || m_num > state[m_uuid]){
                state[m_uuid] = m_num;
            }
        }
    }

    getNextIndex: function(){
        return this.state[this.uuid] + 1;
    }

    retrieveMessages: function(senderId, indexFrom){
        ret = [];
        if(this.messages.hasOwnProperty(senderId)){
            for(var m of this.messages[senderId]){
                if(this.messages[senderId].hasOwnProperty(m) && m > indexFrom){
                    ret.push(this.messages[senderId][m]);
                }
            }
        }
        return ret;
    }

    retrieveAllMessages: function(){
        var ret = [];
        for(var uuid of this.messages){
            if(this.messages.hasOwnProperty(uuid)){
                ret = ret.concat(thie.retrieveMessages(uuid,-1));
            }
        }
        return ret;
    }

    getRandomMessage: function(){
        var res = {};
        var allMessages = this.retrieveAllMessages();
        res.message = allMessages[Math.floor(Math.random() * allMessages.length)]
        res.target = this.peers[Math.floor(Math.random() * this.peers.length)]
        return res;
    }

    // Lab 2
    addHost: function(host){
        this.hosts.push(host);
    }
}

// Initialization
(function init(){
    var test1_uuid = uuid.v4();
    var test2_uuid = uuid.v4();
    var test3_uuid = uuid.v4();
    credentials["Test1test"] = test1_uuid;
    credentials["Test2test"] = test2_uuid;
    credentials["Test3test"] = test3_uuid;
    var creds1 = {username:"Test1",password:"test"};
    var creds2 = {username:"Test2",password:"test"};
    var creds3 = {username:"Test2",password:"test"};

    var example1Message = {
        "Rumor" : {
            "MessageID": test1_uuid+":0" ,
            "Originator": "Test1",
            "Text": "I saw mommy kissing Santa Clause!"
        },
        "EndPoint": "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test1_uuid
    }

    var example2Message = {
        "Rumor" : {
            "MessageID": test2_uuid+":0" ,
            "Originator": "Test2",
            "Text": "They say that the owl named Kaepora Gaebora is the reincarnation of an ancient Sage."
        },
        "EndPoint": "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test2_uuid
    }

    var example3Message = {
        "Rumor" : {
            "MessageID": test3_uuid+":0" ,
            "Originator": "Test3",
            "Text": "They say that you can swim faster by continuously pressing B."
        },
        "EndPoint": "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test3_uuid
    }

    var ep1 = "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test1_uuid;
    var ep2 = "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test2_uuid;
    var ep3 = "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/gossip/" + test3_uuid;

    var messages1 = {test1_uuid:{0:example1Message}}
    var state1 = {}
    var peers1 = [ep2];
    userDatas[test_uuid] = new UserData(test1_uuid, creds, -1, messages1, state1, peers1);

    var messages2 = {test2_uuid:{0:example2Message}}
    var state2 = {}
    var peers2 = [ep1,ep3];
    userDatas[test_uuid] = new UserData(test2_uuid, creds, -1, messages2, state2, peers2);

    var messages3 = {test3_uuid:{0:example3Message}}
    var state3 = {}
    var peers3 = [ep1];
    userDatas[test_uuid] = new UserData(test3_uuid, creds, -1, messages3, state3, peers3);

})();

// Message Preparation

function prepareMessage(id,want){
    var ret = [];
    if(!id || !userData[id] || !want || !want.uuid || !want.index){ return ret; }
    var uuid = want.uuid;
    var index = want.index;
    ret = userDatas[id].retrieveMessages(uuid,index);
    return ret;
}

function getPropRandData(id){
    var ret = null;
    if(!id || !userData[id]){ return ret; }
    ret = userDatas[id].getRandomMessage();
    return ret;
}

//==============================================================================
//
//                          Express Endpoints
//
//==============================================================================


/**
 * General Landing Point
 */
app.get('/', function (req, res) {
    res.sendFile("login.html", {root: __dirname});
})

/**
 * General Landing Point
 */
app.get('/favicon.png', function (req, res) {
    res.sendFile("favicon.png", {root: __dirname});
})

/**
 * Login endpoint
 */
app.post('/login', function (req, res) {
    var data = req.body;
    console.log("Login Requested with data",data);
    if(data.hasOwnProperty("username") && data.hasOwnProperty("password") && data.username && data.password && data.username.length > 3 && data.password.length > 3){
        var key = data.username+data.password;
        if(!credentials.hasOwnProperty(key)){
            var user_uuid = uuid.v4();
            credentials[key] = user_uuid;
            userDatas[user_uuid] = ud;
            var ud = new userData(user_uuid, data, -1, {}, {}, {});
            res.session.uuid = user_uuid;
            res.session.userData = ud;
            res.session.cookie.uuid = user_uuid;
            console.log("Created account for user",data,"with data",ud);
        }
        res.session.userData = userDatas[credentials[key]];
    }
    else{
        res.sendStatus(401);
    }
    res.send();

});

/**
 * Gets the main page
 */
app.get('/main', function (req, res) {
    res.sendFile("service.html", {root: __dirname});
});

/**
 * Gets the users messages
 */
app.get('/gossip/', function (req, res) {
    try{
        var id = req.session.uuid;
        if(!id){throw "Could not retrieve messages"}
        console.log("Getting messages for ",id);
        var rumors = req.session.userData.retrieveAll();
        res.send(rumors);
    }
    catch(e){
        console.log("Error in getting message:",e);
        res.send();
    }
});

/**
 * Adds a message from the user
 */
app.post('/gossip/:uuid', function (req, res) {
    var id = req.params.uuid
    var message = req.body;

    console.log("Recieving message for",id,message);

    if(!message){
        res.send("Incomplete message");
        return;
    }

    if(messages.hasOwnProperty(id)){
        res.send("Unknown User ID");
        return;
    }
    console.log("Adding Message for user",id, message);

    if(isRumor(message) &7 userDatas.hasOwnProperty(id)){
        userDatas[id].storeMessage(message);
        res.send('Message recieved!');
    }
    else if(isWant(message)){
        // TODO: Use the workQueue to implement this part.
        var wantQueue = new workQueue(message);
        while(!wantQueue.isEmpty()){
            var order = wantQueue.pop();
            var toSend = prepareMessage(id,order);
            // message.Endpoint // <-- Send to this address.
        }
    }
});

function propogate(){

}

/**
 *
 */
app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})