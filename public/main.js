// Add write listener on keyup for textarea...
//
//
// FIXME: BUGS
// 1) Don't move the cursor as I am typing...
//
//
// TODO:
// - have user A and user B
// - TEST offline changes and how they sync
// 	- verify staleness of the proposed changes... If there are newer accepted changes we should first support those
// 	- if too much out of sync, show them side by side and allow people to manually bring in changes... from a side notepad?
// - think about abuse, and policy limits and read / write rights, so I don't lose all moneys

// for now, we'll send the whole payload up... Eventually we'll want to track only the changes... in a safe mutation way... That can we replayed and synced... Try my own ways and then look to fancier CS papers and algorithms after that...

// send textarea updates...
// document.getElementById('text-field').addEventListener('keyup', function(e) {
//   console.log(e.target.value);
//   var newContent = e.target.value;
//
//   var currentSessionKey = '01';
//
//   var updates = {};
//   updates[`/sessions/${currentSessionKey}/content`] = newContent;
//   // updates['/user-posts/' + uid + '/' + newPostKey] = postData;
//
//   // TODO: we must debounce these update DB writes somehow... Though websockets makes the network penalty much less looks like...
//   firebase
//     .database()
//     .ref()
//     .update(updates);
// });

// when we update the code, send update realtime on each keystroke to Firebase
jar.onUpdate(code => {
  var currentSessionKey = '01';

  var updates = {};
  updates[`/sessions/${currentSessionKey}/content`] = code;

  firebase
    .database()
    .ref()
    .update(updates);
  // console.log(code);
});
