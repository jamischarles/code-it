// this file is in charge of sending & receiving data...
//
import {
  mergeRemoteOperation,
  getOpQueue,
  flushOpQueue,
  updatePeerState,
  saveOwnCaretPos,
  saveOwnSelection,
  getFirstLiveChar,
  getState,
  getSelectionRangeBoundaries,
} from './state';
import {getActiveRowEl, saveCaretPos} from './prism_exp';
import {renderPeerCarets, getCharAtPosition} from './render';
// FIXME: consider renaming it to something more generic...

// TODO: consider using proxy values to listen to these for updates so we can then call init functions that rely on these...
export var db;
// we cannot export this, because we'll run into race conditions if this isn't set when it's exported. That's why we need to export a getter instead...
// That would also allow us to observe this value with a proxy if we needed to...
let PEER_ID;
export let SESSION_KEY;

// every second send the queue if anything is in it
setInterval(sendOpQueue, 1000);

export function getSelfPeerId() {
  return PEER_ID;
}

//
// send operations to the server
// Q: If we rapidly send 5 updates, will those 5 be pushed out to listening clients, or will some be dropped?
// ops = array
export function sendUpdate(operation) {
  // FIXME: store this in localstorage or in global window?
  var currentSessionKey = window.location.hash.replace('#', '');

  // create unqiue ID for this op
  // TODO: use postListref style instead?
  // https://firebase.google.com/docs/database/web/lists-of-data
  // var uid = db.ref(`sessions/${currentSessionKey}/updates`).push({}).key;

  var updatesRef = db.ref(`sessions/${currentSessionKey}/updates`);

  // Create a new post reference with an auto-generated id
  var newUpdateRef = updatesRef.push();
  // console.log('operation to send to FB', operation);

  // sanitize payload for FB. (doesn't allow undefiend values to be sent
  // FIXME: Find a less heacky way for this moving forward...
  // FIXME: 1) add an at: value for row as well
  // when we don't have a first char, just use the rowID
  // 2) rename AT, and split out to "charsToRemove: []"
  // and "insertAfter"? or insertAt
  // TODO later... Consider making it less chatty by sending word insertions together...
  // If one person types "Hello" while the other person writes something else, we really want to instert "insert(a1, hello)" instead of breaking
  // up the chars...
  // how it's broken up will depend on what events come in from the other peers...
  if (typeof operation.insertAfter === 'undefined')
    delete operation.insertAfter;
  if (typeof operation.charId === 'undefined') delete operation.charId;

  if (!operation.value) delete operation.value;

  if (operation.insertChars) {
    // loop through insert objects and remove keys with null values
    for (var i = 0; i < operation.insertChars.length; i++) {
      var char = operation.insertChars[i];
      if (!char.insertAfter) delete char.insertAfter;
      delete char.pos; // don't need to xfer this
    }
  }

  operation.peer = PEER_ID;
  // console.log('operation.peer', operation.peer);

  delete operation.meta;

  newUpdateRef.set(operation);

  // console.log('uid', uid);

  return;

  // console.log('newSessionKey', newSessionKey);

  var updates = {};
  updates['/sessions/' + newSessionKey] = {
    content: 'function() {}', // starting info...
    name: 'Anon', // timestamp: Date.now(),
    startedAt: firebase.database.ServerValue.TIMESTAMP,
  };

  db.ref().update(updates);
  window.location.hash = newSessionKey;

  var updates = {};
  updates[`/sessions/${currentSessionKey}/updates`] = contentToPush;

  // console.log('contentToPush', contentToPush);

  // TODO: we must debounce these update DB writes somehow... Though websockets makes the network penalty much less looks like...
  firebase
    .database()
    .ref()
    // .set(updates);
    .update(updates);
  // Q: Diff between update and SET?
  // https://medium.com/@jasonbyrne/closer-look-at-firebase-set-versus-update-eceff34d056b
  //
  //
  // create a unique ID for the item, and then push it.

  // TODO: when we send a snapshot we can wipe out the updates arr...
  // if it's just a stream can we just replace each one anyway? TODO: research how FB handles that...
}

// FIXME: move this behind a fn?
document.addEventListener('DOMContentLoaded', function() {
  var config = {
    apiKey: 'AIzaSyBAGaPPcu3kGWZLDj_u-UvFc8whXkUAdpoa', // authDomain: "code-it-228a1.firebaseapp.com",
    databaseURL: 'https://code-it-228a1.firebaseio.com', // storageBucket: "bucket.appspot.com"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  } // Get a reference to the database service

  db = firebase.database();

  var newSessionKey = window.location.hash.replace('#', '');

  // if hash already exists, use that session. Else create a new one...
  if (!newSessionKey) {
    // for this path we KNOW this user is CREATING the ROOM (shared session)
    newSessionKey =
      newSessionKey ||
      db.ref('sessions').push({
        startedAt: firebase.database.ServerValue.TIMESTAMP,
      }).key;

    // console.log('newSessionKey', newSessionKey);

    var updates = {};
    updates['/sessions/' + newSessionKey] = {
      // content: 'function() {}', // starting info...
      // FIXME: come up with interesting animal names for this...
      // STARTING ID at 'a' which is 10 (TEN) in base 10
      peers: {
        nextPeer: genNextPeerID('a'),
        // a: {
        //   caretPos: {},
        //   status: 'online',
        // },
      },
      name: 'Anon', // timestamp: Date.now(),
      startedAt: firebase.database.ServerValue.TIMESTAMP,
    };

    PEER_ID = 'a'; // 'a' // We KNOW we are the first peer for this room...
    // FIXME: consider what happens if you put an invalid / expired session key into the URL.
    // We need to handle that use case...

    db.ref().update(updates);
    window.location.hash = newSessionKey;

    // save it as CONST Var for internal sharing...
    SESSION_KEY = newSessionKey;

    // FIXME: add logic here for fetching the session key, and ensuring it's valid and that we have all the client data we need about peers, etc...

    // FIXME: consider making this more streamlined... Right now we call this in 2 places that aren't really same same...
    // Consider calling setMyPeerID from here...
    afterDbIsReady();
  } else {
    // NAIVE: CONNECTION to existing sessions by way of passing a session key in the url...
    // peers will ONLY be assigned at startup...
    // TODO: we should really put this in an INIT step or something...
    // save it as CONST Var for internal sharing...
    SESSION_KEY = newSessionKey;
    setMyPeerID();
  }

  var updatesRef = db.ref(`sessions/${newSessionKey}/updates`);

  // only send me the last update when a new update is pushed to DB
  // TODO: ignore my own updates
  // on refresh, we get ALL the children. Which is perfect for our use case...
  updatesRef.on('child_added', data => mergeRemoteOperation(data.val()));

  // on connect send me ALL updates
  db.ref(`sessions/${newSessionKey}/updates`).on('value', snapshot => {
    var obj = snapshot.val();

    // receiveRemoteChanges(obj)
    // FIXME: change to receive?
    // ignore if I'm  the peer...
    // FIXME: can we avoid listening to our own updates?
    // mergeRemoteOperation(obj);
    // receiveUpdate(obj);
  });
});

// talk to FB. Decide what peer I should be. Assign that letter locally, and then update FB so nobody else takes that peer ID.
function setMyPeerID() {
  // updates['/sessions/' + newSessionKey] = {
  //   // content: 'function() {}', // starting info...
  //   // FIXME: come up with interesting animal names for this...
  //   peers: {
  //     nextPeer: 'b',
  //     a: {
  //       caretPos: {},
  //       status: 'online',
  //     },
  //   },
  //   name: 'Anon', // timestamp: Date.now(),
  //   startedAt: firebase.database.ServerValue.TIMESTAMP,
  // };
  //
  // PEER_ID = 'a'; // We KNOW we are the first peer for this room...
  // // FIXME: consider what happens if you put an invalid / expired session key into the URL.
  // // We need to handle that use case...
  //
  // db.ref().update(updates);
  // console.log('SESSION_KEY', SESSION_KEY);

  var peersRef = db.ref(`/sessions/${SESSION_KEY}/peers`);
  peersRef.transaction(
    function(currentData) {
      // console.log('currentData', currentData);
      // if data hasn't been fetched yet, just return the null, so it will retry
      if (currentData === null) return currentData;

      // currently using hex as the peerID, but could really be anything. Tried [a-z] but ran out too quickly because I'm treating every refresh as a new peer
      let myPeerId = currentData && currentData.nextPeer;

      if (!myPeerId) return; // ABORT the transaction. Would  we ever want this?

      let nextPeerId = genNextPeerID(myPeerId);

      PEER_ID = myPeerId;
      return Object.assign({}, currentData, {
        nextPeer: nextPeerId, // FIXME: this could be so much simpler if we used a NUMBER here... oh well...
        // We don't need to store the peer id under /peers...
        // [myPeerId]: {
        //   caretPos: {},
        //   status: 'online',
        // },
      });

      // return currentData;
      // if (currentData === null) {
      //   return { name: { first: 'Ada', last: 'Lovelace' } };
      // } else {
      //   console.log('User ada already exists.');
      //   return; // Abort the transaction.
      // }
    },
    function(error, committed, snapshot) {
      if (error) {
        console.log('Transaction failed abnormally!', error);
      } else if (!committed) {
        console.log('We aborted the transaction (because ada already exists).');
      } else {
        console.log('Registered new PEER:', PEER_ID);
      }
      console.log('PEER data: ', snapshot && snapshot.val());
      // Call this here, because at this point PEER_ID is ready AND the DB is ready...
      afterDbIsReady();
    },
  );
}

// for now just use hex... short, and goes high enough
// maybe later something more readable like a,b,c, a1...a99, b1...b000 etc...
// return a new hex value that is +1 (base 10) of the old hex value
function genNextPeerID(hex) {
  // return hexstr value of number
  // convert hex FROM base 16 to base10 and the add 1
  var num = parseInt(hex, 16) + 1;
  // convert back to hex and return
  return num.toString(16);
}

// periodically we'll flush the op queue and send it
// this allows us to decouple renders from sending updates...
// Q: Should these be coupled?
// we need a way to allow for batching state updates w/o sending each one...
function sendOpQueue() {
  console.log('sendingOpQueue...');
  // send the update to other peers as operations
  var ops = getOpQueue();

  if (ops.length === 0) return;

  // FIXME: wait to flush until we can aknowledge that FB accepted this...
  // TODO: don't send in offline mode? Or just have some way to queue up and reflush on connection...
  flushOpQueue(); // maybe ensure we only flush ids that have been sent? or we could have race conditions

  console.log('sendingOpQueue', ops);
  // console.log('##########ops from queue', ops);
  ops.forEach(op => sendUpdate(op));
}

function sendStatusUpdate(isOnline) {
  if (isOnline) {
    console.log('CONNECTED');
  } else {
    console.log('NOT CONNECTED');
  }
  // update self status in /online-peers
  // update self status
}

// send caret pos to other peers
export function sendCaretPos() {
  // send current caret Pos
}

// TODO: consider making a very simple pub/sub event system for local events
// onile,offline, movecaret, etc...
// FIXME: break this out into /subscribe online/iffline state fn
function afterDbIsReady() {
  // LISTEN FOR SELF status changes
  var connectedRef = db.ref('.info/connected');
  // when connectionStatus Changes...
  // set myself as onfline/offline
  connectedRef.on('value', function(snap) {
    if (snap.val() === true) {
      sendStatusUpdate(true);

      var myConnectionsRef = db.ref(
        `/sessions/${SESSION_KEY}/online-peers/${PEER_ID}`,
      );

      // We're connected (or reconnected)! Do anything here that should happen only if online (or on reconnect)
      // var con = myConnectionsRef.push({id: '5', onilne: 'hi'});
      //
      // FIXME: do we even need this? Or is an empty obj enough?
      myConnectionsRef.set({status: 'online'});

      // remove this reference on disconnect (this op is stored on server)
      // FIXME: do we need to clean this up? are we getting too many listeners?
      // Should this be separate from online handler?
      myConnectionsRef.onDisconnect().remove();
      document.getElementById('online-status').innerHTML = 'ONLINE';
    } else {
      sendStatusUpdate(false);

      document.getElementById('online-status').innerHTML = 'OFFLINE';
      // FIXME: NOT working. Probably being overridden by the other one... May need to check the status down below when we update other peers...
      document.getElementById('online-peers').innerHTML = '?'; // we are offline, so we don't know...
      // TODO: call .off()?
    }
  });

  // listen for other PEER status changes
  var onlinePeersRef = db.ref(`/sessions/${SESSION_KEY}/online-peers/`);

  // FIXME: this will probably fire when caret pos changes...
  // instead I should listen to childRemoved or childAdded
  onlinePeersRef.on('value', snap => {
    // console.log('onlinePeers status changed...');
    var onlinePeers = [];
    var onlinePeersObjects = [];
    snap.forEach(function(childSnapshot) {
      var childKey = childSnapshot.key;
      var childVal = childSnapshot.val();
      onlinePeers.push(childKey);

      // FIXME: clean up this confusing logic...
      onlinePeersObjects.push(
        Object.assign({}, childVal, {
          peerId: childKey,
        }),
      );
    });

    // update the DOM... FIXME: maybe add this to render...?
    // or have render listen to a state update?
    // FIXME: this should NOT live here...
    // PUT THis in state, and then render from state in render instead...
    document.getElementById('online-peers').innerHTML = onlinePeers;

    updatePeerState(onlinePeersObjects);
  });

  // listen for caret change and send update to FB
  // FIXME: consider throttling it...
  // send the charID that it's at... That way the other app can render it based on the local position of that char. YES.
  // Caret should be sticky to the char that it's resting on...
  //
  // Q: How do I get the charID from the caret?
  //    - get line:pos
  //    - rows[line][pos].charId
  //    saveCaretPos()
  //
  // that is really what we should store in state...?
  // does that work with empty spaces? For now just keep the current state...
  // TODO: see how this works when we're on an empty space...
  // If it's empty we can use offset?
  //
  // FIXME: debounce this?
  document.addEventListener('selectionchange', e => {
    // debugger;
    // console.log('selection changed!', document.getSelection());
    // TODO: debounce the execution of this...
    var rowEl = getActiveRowEl();
    var pos = saveCaretPos(rowEl);
    // line:pos...
    // console.log('#99) pos', pos);
    var t = getCharAtPosition(pos);
    var id = t && t.id;

    // if selection, get selection start/stop chars so we can send that to other peers...
    var {start, end} = getSelectionRangeBoundaries();
    // console.log('#-2 SELECTION start', start);
    // console.log('#-2 SELECTION end', end);
    if (start && end) {
      var selStartChar = getCharAtPosition(start, true);
      var selEndChar = getCharAtPosition(end, true);
      // console.log('#-2.5 SELECTION selStartChar', selStartChar);
      // console.log('#-2.5 SELECTION selEndChar', selEndChar);
    }

    // if there's no char, assume beginning of line... Grab the first live char, and store that...
    if (!t) {
      // if there's no char, pass the rowID
      // OR can we pass a special prefix that says BEFORE this char?
      // FIXME: ^ is what we'll need to do if we get weird caret bugs at beginning of the line...
      // bc we ALWAYS need to be sticky to a char...
      //   t = getFirstLiveChar();
      //   id = t && t.id;
    }

    // FIXME: how can I signify END OF LINE? or START OF LINE? does it make sense to just have a placeholder char for EOL?
    // like $$? that could be interesting... maybe I can store $$ as EOL...?
    // Is that a hacky workaround? or is there a better solution?
    // Q: Why does the manual caretRender work, but not the peerRender?
    // That's really the problem I need to solve. Converge the methods I use... YES

    // console.log('sc:-------------------');
    // console.log('sc:rowEl', rowEl);
    // console.log('sc:pos', pos);
    // console.log('sc:t', t);
    // console.log('sc:charPos', t.pos);
    // console.log('sc:state', getState().rows);

    if (!id) return;

    // save off self caret pos in state, so state.caret is never stale...
    saveOwnCaretPos(id, start, end); // do we need start/end selection?
    saveOwnSelection();

    // FIXME: should we store this on peers/caret instead? Will tihs mess with the online status? Shouldn't...
    // console.log('SESSION_KEY', SESSION_KEY);
    // console.log('PEER_ID', PEER_ID);
    var peerRef = db.ref(`/sessions/${SESSION_KEY}/online-peers/${PEER_ID}`);

    // We're connected (or reconnected)! Do anything here that should happen only if online (or on reconnect)
    // var con = myConnectionsRef.push({id: '5', onilne: 'hi'});
    //
    var updates = {};
    updates[`/sessions/${SESSION_KEY}/online-peers/${PEER_ID}/caret`] = id;

    // if there's a selection, send the selection start/stop chars to peers
    // if not, remove those values
    if (start && end) {
      updates[`/sessions/${SESSION_KEY}/online-peers/${PEER_ID}/selStart`] =
        selStartChar.id;
      updates[`/sessions/${SESSION_KEY}/online-peers/${PEER_ID}/selEnd`] =
        selEndChar.id;
    } else {
      updates[
        `/sessions/${SESSION_KEY}/online-peers/${PEER_ID}/selStart`
      ] = null;
      updates[`/sessions/${SESSION_KEY}/online-peers/${PEER_ID}/selEnd`] = null;
    }

    db.ref().update(updates);

    // FIXME: remove...
    // renderPeerCarets();

    // TODO: we must debounce these update DB writes somehow... Though websockets makes the network penalty much less looks like...
  });

  // LISTEN for peer caret position changes... (debounce this?) Q:Can we tell FB to throttle?
}

// subscribe to pos change?
//
