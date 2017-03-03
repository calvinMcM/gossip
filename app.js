var express = require('express');
var app = express();
var session = require('express-session');
var request = require('request');
var needle = require('needle');

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
var s_root = "http://ec2-54-227-197-88.compute-1.amazonaws.com:3000/"
// var s_root = "http://localhost:3000/"

// Message Reception Logic

function WorkQueue(want){
    if(!isWant(want)){ return; }
    this.queue = [];
    var work = want.Want;
    for(var unit in work){
        this.queue.push({uuid:unit,index:work[unit]});
    }
}

/**
 * Returns an object of form {uuid,index} that can be processed.
 */
function pop(q){
    if(!isEmpty(q)){
        return q.queue.shift();
    }
}

//==============================================================================
//
//                      Utility Functions
//
//==============================================================================

/**
 * Returns a boolean condition about whether or not the queue is empty.
 */
function isEmpty(q){
    return !q.queue.length;
}

function isRumor(message){
    return message.hasOwnProperty("Rumor");
}

function isWant(message){
    return message.hasOwnProperty("Want");
}

function toObject(input){
    ret = input;
    if(typeof input != "object"){
        try{
            ret = JSON.parse(input);
        }
        catch(e){}
    }
    return ret;
}

function toJString(input){
    ret = input;
    if(typeof input != "string"){
        try{
            ret = JSON.stringify(input);
        }
        catch(e){}
    }
    return ret;
}

//==============================================================================
//
//                      UserData Storage
//
//==============================================================================

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
            console.log("\n\nStoring message from",m_uuid,"Index:",m_num,"\n\n");
            struct.messages[m_uuid][m_num] = JSON.stringify(message);

            // Update state message index tracker
            if(!struct.state.hasOwnProperty(m_uuid) || m_num > struct.state[m_uuid]){
                console.log("Updating index state to",m_num);
                struct.state[m_uuid] = m_num;
            }
            else{
                console.log("ARG!",struct.state.hasOwnProperty(m_uuid),struct.uuid,m_uuid,struct.state[m_uuid],m_num);
            }
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
        console.log("Generating Prop for",struct.uuid,"from",allMessages);
        res.message = allMessages[Math.floor(Math.random() * allMessages.length)]
        res.target = struct.peers[Math.floor(Math.random() * struct.peers.length)]
        console.log("Generating random message:",res);
        return res;
    }

    function getWant(struct){
        var res = {};
        var limitedState = {};

        console.log("Constructing want for",struct.uuid,"from",struct.state)

        for(var id in struct.state){
            if(struct.state[id] > -1){
                limitedState[id] = struct.state[id];
            }
        }

        res.want = {
            Want:limitedState,
            EndPoint:s_root + "gossip/" + struct.uuid
        }
        res.target = struct.peers[Math.floor(Math.random() * struct.peers.length)]
        console.log("Generating want:",res.want);
        return res;
    }

    // Lab 2
    function addPeer(struct,peer){
        struct.peers.push(peer);
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
    var creds3 = {username:"Test3",password:"test"};

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

    var messages1 = {test1_uuid:{0:JSON.stringify(example1Message)}}
    var state1 = {}
    var peers1 = [ep2];
    userDatas[test1_uuid] = new UserData(test1_uuid, creds1, -1, messages1, state1, peers1);

    var messages2 = {test2_uuid:{0:JSON.stringify(example2Message)}}
    var state2 = {}
    var peers2 = [ep1,ep3];
    userDatas[test2_uuid] = new UserData(test2_uuid, creds2, -1, messages2, state2, peers2);

    var messages3 = {test3_uuid:{0:JSON.stringify(example3Message)}}
    var state3 = {}
    var peers3 = [ep1];
    userDatas[test3_uuid] = new UserData(test3_uuid, creds3, -1, messages3, state3, peers3);

};
init();

//==============================================================================
//
//                          Message Preparation
//
//==============================================================================

function prepareMessage(id,want){
    var ret = [];
    if(!id || !userDatas[id] || !want || !want.uuid || !want.index){ return ret; }
    var uuid = want.uuid;
    var index = want.index;
    ret = retrieveMessages(userDatas[id],uuid,index);
    return ret;
}

function getPropRandData(id){
    var ret = null;
    if(!id || !userDatas[id]){ return ret; }
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
    console.log("Adding Message for user",id, message, typeof message );

    if(!isRumor(message) && !isWant(message)){
        for(var item in message){
            message = item;
            try{
                if(typeof message != "object"){
                    message = JSON.parse(message);
                }
            }
            catch(e){}
            break;
        }
    }

    if(isRumor(message) && userDatas.hasOwnProperty(id)){
        console.log("Storing message!");
        storeMessage(userDatas[id],message);

        console.log("\n\nUser",id,"now has the following",userDatas[id]);

        res.send(JSON.stringify({nextid:getNextIndex(userDatas[id])}));
        return;
    }
    else if(isWant(message)){
        // TODO: Use the workQueue to implement this part.
        var wantQueue = new WorkQueue(message);
        while(!isEmpty(wantQueue)){
            var order = pop(wantQueue);
            var toSend = prepareMessage(id,order);
            for(var messageIndex in toSend){
                console.log("Posting Wanted Material to",message.EndPoint,messageIndex,toSend[messageIndex]);
                needle.post(message.EndPoint,toSend[messageIndex])
            }
            // message.Endpoint // <-- Send to this address.
            // TODO: Update state
        }
    }
    else{
        console.log("\n\n\t\tMessage is rumor",isRumor(message));
        console.log("\t\tMessage is want",isWant(message));
        console.log("\t\tId",id,"is known",userDatas.hasOwnProperty(id))
        if(typeof message != "object"){
            console.log("\t\tAlso, it isn't an object, silly.")
        }
        console.log("\t\tMessage:",message,"\n\n");
    }
    res.send(JSON.stringify({nextid:getNextIndex(userDatas[id])}));
});

function propagate(){
    for(var i in userDatas){
        if(userDatas.hasOwnProperty(i)){
            console.log("[][][] PROPAGATION ON",i);
            switch(Math.floor(Math.random() * 2)){
                case 0:
                    console.log("Send out a want")
                    var w = getWant(userDatas[i]);
                    needle.post(w.target,w.want);
                    break;
                case 1:
                    console.log("Send out a rumor")
                    var mess = getPropRandData(i);
                    console.log("/tSending:",JSON.stringify(mess.message));
                    needle.post(mess.target,mess.message);
                    break;
            }
        }
    }
    setTimeout(propagate,10000);
}

var started = false;

/**
 *
 */
app.listen(3000, function () {
    console.log('Gossip app listening on port 3000!')
    if(!started){
        started = true;
        propagate();
    }
})
