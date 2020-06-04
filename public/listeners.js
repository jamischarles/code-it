import {updateEditorWithNewCode} from './prism_exp';

document.addEventListener('DOMContentLoaded', function() {
  // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
  // // The Firebase SDK is initialized and available here!
  //
  // firebase.auth().onAuthStateChanged(user => { });
  // firebase.database().ref('/path/to/ref').on('value', snapshot => { });
  // firebase.messaging().requestPermission().then(() => { });
  // firebase.storage().ref('/path/to/ref').getDownloadURL().then(() => { });
  //
  // https://code-it-228a1.firebaseio.com/
  // Set the configuration for your app
  var config = {
    apiKey: 'AIzaSyBAGaPPcu3kGWZLDj_u-UvFc8whXkUAdpoa', // authDomain: "code-it-228a1.firebaseapp.com",
    databaseURL: 'https://code-it-228a1.firebaseio.com', // storageBucket: "bucket.appspot.com"
  };
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  } // Get a reference to the database service
  var db = firebase.database(); // if hash already exists, use that session. Else create a new one...
  // var recentPostsRef = database.ref('testingg').limitToLast(100); // console.log('HELLLOO') // FIXME: I only want to listen to the 1 session from the OTHER person... // on DB change, update // Get a key for a new session. // FIXME: Why is the space all funky.. //
  var newSessionKey = window.location.hash.replace('#', '');
  if (!newSessionKey) {
    newSessionKey =
      newSessionKey ||
      db.ref('sessions').push({
        startedAt: firebase.database.ServerValue.TIMESTAMP,
      }).key;
    console.log('newSessionKey', newSessionKey);
    var updates = {};
    updates['/sessions/' + newSessionKey] = {
      content: 'function() {}', // starting info...
      name: 'Anon', // timestamp: Date.now(),
      startedAt: firebase.database.ServerValue.TIMESTAMP,
    };
    db.ref().update(updates);
    window.location.hash = newSessionKey;
  }
  var editor = document.querySelector('#editor');
  db.ref(`sessions/${newSessionKey}`).on('value', snapshot => {
    let arr = [];
    console.log('##### value on server updated', snapshot);
    snapshot.forEach(snap => {
      // console.log('#### snap', snap);
      arr.push(snap.val());
    }); // updateEditorWithNewCode(arr[0]); // TODO: for this we'll need to see WHO made the change during the resolution phase... // NAIVE implementation for now... // FIXME: is anchorNode the best node to use? // TODO: abstract this, and move parts of it to the exp page... // OR another page... // TODO: try marker insertion first, and then we can try the other method... // sp2.focus(); // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥 // is this harder or easier than my fancy insertion way? which is more reliable and performant? // sp2.children[2].focus()
    // has the content changed? // FIXME: abstract this...
    try {
      let app = firebase.app();
      let features = ['auth', 'database', 'messaging', 'storage'].filter(
        feature => typeof app[feature] === 'function',
      );
      // document.getElementById('load').innerHTML = `Firebase SDK loaded with ${features.join(', ')}`;
    } catch (e) {
      console.error(e); // document.getElementById('load').innerHTML = 'Error loading the Firebase SDK, check the console.';
    }
  });
});
