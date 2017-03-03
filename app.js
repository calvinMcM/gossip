var express = require('express');
var app = express();
var session = require('express-session')
var request = require('request')

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

// Server root
// var s_root = "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/"
var s_root = "http://localhost:3000/"

// Message Reception Logic

function workQueue(want){
    if(!isWant(want)){ return; }
    this.queue = [];
    var work = want.Want;
    for(var unit of work){
        this.queue.push({uuid:unit,index:work[unit]});
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

function UserData(uuid, credentials, messageIndex, messages, state, peers){
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

    function storeMessage(struct,message){
        if(isRumor(message)){
            var body = message.Rumor;
            console.log("Mess:",message,message.Rumor);
            var m_id = body.MessageID;
            var m_parts = m_id.split(":");
            var m_uuid = m_parts[0];
            var m_num = m_parts[1];
            if(!struct.messages.hasOwnProperty(m_uuid)){
                struct.messages[m_uuid] = {};
            }
            console.log("Storing message from",m_uuid,"Index:",m_num);
            struct.messages[m_uuid][m_num] = JSON.stringify(message);

            // Update state message index tracker
            if(!struct.state.hasOwnProperty(m_uuid) || m_num > struct.state[m_uuid]){
                console.log("Updating index state to",m_num);
                struct.state[m_uuid] = m_num;
            }
            else{
                console.log("ARG!",struct.state.hasOwnProperty(m_uuid),struct.uuid,m_uuid,struct.state[m_uuid],m_num);
            }
            console.log("Finished processing",struct);
        }
        else{
            console.log("Cannot store non-rumor",message);
        }
    }

    function getNextIndex(struct){
        try{
            console.log("Getting next index on",struct.uuid,struct.state[struct.uuid]);
            var val = parseInt(struct.state[struct.uuid]) + 1;
            console.log("Returning",val)
            return val;
        }
        catch(e){
            return 0;
        }
    }

    function retrieveMessages(struct,senderId, indexFrom){
        ret = [];
        // console.log("Retrieving message for",senderId,"on",indexFrom);
        if(struct.messages.hasOwnProperty(senderId)){
            // console.log("Looks like",struct.messages[senderId]);
            for(var m in struct.messages[senderId]){
                if(struct.messages[senderId].hasOwnProperty(m) && m > indexFrom){
                    ret.push(struct.messages[senderId][m]);
                }
            }
        }
        return ret;
    }

    function retrieveAllMessages(struct){
        var ret = [];
        // console.log("Retrieving all in",struct);
        for(var uuid in struct.messages){
            // console.log("Reviewing message from",uuid,struct.messages);
            if(struct.messages.hasOwnProperty(uuid)){
                ret = ret.concat(retrieveMessages(struct,uuid,-1));
            }
        }
        // console.log("Retrieval of messages returning:",ret)
        return ret;
    }

    function getRandomMessage(struct){
        var res = {};
        var allMessages = retrieveAllMessages(struct);
        res.message = allMessages[Math.floor(Math.random() * allMessages.length)]
        res.target = struct.peers[Math.floor(Math.random() * struct.peers.length)]
        return res;
    }

    // Lab 2
    function addHost(struct,host){
        struct.hosts.push(host);
    }


// Initialization
function init(){
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
        "EndPoint": s_root + "gossip/" + test1_uuid
    }

    var example2Message = {
        "Rumor" : {
            "MessageID": test2_uuid+":0" ,
            "Originator": "Test2",
            "Text": "They say that the owl named Kaepora Gaebora is the reincarnation of an ancient Sage."
        },
        "EndPoint": s_root + "gossip/" + test2_uuid
    }

    var example3Message = {
        "Rumor" : {
            "MessageID": test3_uuid+":0" ,
            "Originator": "Test3",
            "Text": "They say that you can swim faster by continuously pressing B."
        },
        "EndPoint": s_root + "gossip/" + test3_uuid
    }

    var ep1 = s_root + "gossip/" + test1_uuid;
    var ep2 = s_root + "gossip/" + test2_uuid;
    var ep3 = s_root + "gossip/" + test3_uuid;

    var messages1 = {test1_uuid:{0:example1Message}}
    var state1 = {}
    var peers1 = [ep2];
    userDatas[test1_uuid] = new UserData(test1_uuid, creds1, -1, messages1, state1, peers1);

    var messages2 = {test2_uuid:{0:example2Message}}
    var state2 = {}
    var peers2 = [ep1,ep3];
    userDatas[test2_uuid] = new UserData(test2_uuid, creds2, -1, messages2, state2, peers2);

    var messages3 = {test3_uuid:{0:example3Message}}
    var state3 = {}
    var peers3 = [ep1];
    userDatas[test3_uuid] = new UserData(test3_uuid, creds3, -1, messages3, state3, peers3);

};
init();

// Message Preparation

function prepareMessage(id,want){
    var ret = [];
    if(!id || !userData[id] || !want || !want.uuid || !want.index){ return ret; }
    var uuid = want.uuid;
    var index = want.index;
    ret = retrieveMessages(userDatas[id],uuid,index);
    return ret;
}

function getPropRandData(id){
    var ret = null;
    if(!id || !userData[id]){ return ret; }
    ret = getRandomMessage(userDatas[id]);
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
            var ud = new UserData(user_uuid, data, -1, {}, {}, {});
            userDatas[user_uuid] = ud;
            console.log("Created account for user",data,"with data",ud);
        }
        udt = userDatas[credentials[key]];
        res.cookie("5Sdata",{
            uuid:udt.uuid,
            nextIndex:getNextIndex(udt),
            username:udt.username
        });
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
app.get('/gossip/:id', function (req, res) {
    try{
        var id = req.params.id;
        if(!id){throw "Could not retrieve messages"}
        // console.log("Getting messages for ",id,req.session);
        var rumors = retrieveAllMessages(userDatas[id]);
	    // console.log("Sending Rumors:",rumors);
        res.cookie("5Sdata",{
            uuid:id,
            nextIndex:getNextIndex(userDatas[id]),
            username:userDatas[id].username
        });
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

    if(!userDatas.hasOwnProperty(id)){
        res.send("Unknown User ID");
        return;
    }
    console.log("Adding Message for user",id, message);

    if(isRumor(message) && userDatas.hasOwnProperty(id)){
        storeMessage(userDatas[id],message);
        res.send(JSON.stringify({nextid:getNextIndex(userDatas[id])}));
    }
    else if(isWant(message)){
        // TODO: Use the workQueue to implement this part.
        var wantQueue = new workQueue(message);
        while(!wantQueue.isEmpty()){
            var order = wantQueue.pop();
            var toSend = prepareMessage(id,order);
            resquests.
            // message.Endpoint // <-- Send to this address.
        }
    }
    res.send(getNextIndex(userDatas[id]));
});

function propogate(){

}

/**
 *
 */
app.listen(3000, function () {
  console.log('Gossip app listening on port 3000!')
})
