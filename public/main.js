// Add write listener on keyup for textarea...
//
//
// TODO: Features to consider...
// 1) + to add another text box of same / different type (html)
//
// FIXME: BUGS
// 1) Don't move the cursor as I am typing...
//  Ways to solve...
//  a) Don't listen to changes from yourself, or rather, don't make updates to changes from yourself...
//  TODO: longer term, should I even be receiving that data? yes or no?
//  b) Control where the cursor is, and manage that with the state from the system...
//
//  TASK NOW:
//  1) keep track of which client is connected (by name or UID). Let's use a UID. and if you are sending the updates, or if you are in sync... then don't apply those updates...
//  2) Once you apply an update, do not reset the cursor position.
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
// q: Can we listen to the parent? So we can swap out the child?
//
function saveCaretPos(editorNode) {
  // try #1: test position along with other data
  if (!editorNode) throw new Error('PLEASE PASS AN EDITORNODE PARAM!!!');

  //
  //
  var pos = window.getSelection(); // get cursor position
  var aNode = pos.anchorNode;
  var aOffset = pos.anchorOffset;

  // move to fn?
  // get charPos from parentNode (editor)
  var curNode = aNode;
  var charCount = aOffset;
  var childNumber = 0; // FIXME: off by one?

  // if parentNode is NOT the editor (like we're the textNode inside a span), go up one level... TODO: consider doing this only once with aNode...
  // FIXME: remove this check?
  // if (curNode.parentNode !== editorNode) curNode =  findHighestAncestor(
  curNode = findHighestAncestor(editorNode, curNode);

  // run the code, and THEN check if we should loop again...
  // needed because we need to count it even when we reach the first one (and there's no previousSibling)
  // TODO: Extract this into separate util fn
  // debugger;
  do {
    var length = curNode.length || curNode.textContent.length; // if textnode, it has length, else we can get the textContent of the tag
    charCount += length;
    curNode = curNode.previousSibling;
    childNumber++;
  } while (curNode.previousSibling);

  return {node: aNode, offset: aOffset, charPosition: charCount, childNumber};
}

// Q: Does offset have to be at the lowest level? Or can it be at a higher level? IS that why codejar traverses the nodes?
function restoreCaretPos(editorNode, posObject) {
  // var node = posObject.node;
  var anchorOffset = posObject.offset;

  // Approach #1: Find node based on char position that was saved earlier...
  var node = findNodeFromCharPos(
    document.getElementById('text-field2'),
    posObject.charPosition,
  );

  var range = document.createRange();
  var sel = window.getSelection();

  // Q: TODO: Maybe simply
  // codejar way
  // sel.setBaseAndExtent;
  // return;
  // old way

  range.setStart(editorNode.childNodes[3], 0);
  // range.setStart(node, 0);
  // range.setStart(el.childNodes[3], 10);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  // todo try the setandextend...?
}

// get the higest ancestor before root
function findHighestAncestor(rootNode, startingNode) {
  var curNode = startingNode;
  while (rootNode != curNode.parentNode) {
    curNode = curNode.parentNode;
  }

  return curNode;
}

// todo: return offset as well...
function findNodeFromCharPos(parentNode, pos) {
  var runningCounter = 0;

  // Learning: only textNodes or .textContent gives you length... (maybe inputs too, but we aren't using  those here)
  // iterate through all the childnodes
  var nodes = parentNode.childNodes;

  for (var i = 0; i < nodes.length; i++) {
    var curNode = nodes[i];

    // we have found the node we are looking for...
    if (runningCounter + curNode.textContent.length > pos) {
      return curNode;
    }

    runningCounter += curNode.textContent.length;
  }
}

// first time...
var oldContent = document.getElementById('text-field2').textContent;
//
document
  .getElementById('text-field2')
  .parentNode.addEventListener('keyup', function(e) {
    var newContent = e.target.textContent;
    var editorNode = document.getElementById('text-field2');
    // var content = e.target.value;
    //
    // // IGNORE arrow keys...
    var key = e.keyCode;
    if (key === 37 || key === 38 || key === 39 || key === 40) return;
    // FIXME: maybe instead we should check if the content has changed or not, but I'll settle for this for now...

    // has content changed? if not, do NOT highlight the code or call the highlighting code...
    // FIXME: compare against newlines too...
    // FIXME: can we just make this better all around?
    if (oldContent === newContent) return;
    console.log('####content has changed!', newContent);

    var pos = saveCaretPos(editorNode);
    console.log('pos', pos);
    //
    hljs.highlightBlock(editorNode);
    // hljs.highlight(document.getElementById('text-field2'));/ can we get this working? This is what codeJar uses..
    //
    restoreCaretPos(editorNode, pos);

    // restore the cursor (FIXME: make this much smaller and isolate all this...)
    // var marker = document.getElementById('caret-marker');
    // if (marker && marker.parentNode) {
    //   console.log('will MOVE BACK');
    //   moveCaret(document.getElementById('caret-marker'), 0);
    // }

    // e.target.value = newContent;
    // e.target.innerHTML = newContent + 1;

    var currentSessionKey = '01';

    var updates = {};
    updates[`/sessions/${currentSessionKey}/content`] = newContent;

    // TODO: we must debounce these update DB writes somehow... Though websockets makes the network penalty much less looks like...
    // firebase
    //   .database()
    //   .ref()
    //   .update(updates);
  });
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

  // firebase
  //   .database()
  //   .ref()
  //   .update(updates);
  // console.log(code);
});

// document.addEventListener('selectionchange', () => {
//   // debugger;
//   console.log('SELECTION CHANGED!', document.getSelection());
// });

// get dom path, similar to my FB thing...
// traverse up the tree from startingNode to rootNode
// return an array of indexes that will give us a path back
// to that same node in a identical tree that is detached from the dom (cloned)
// took me 10min to write. Wow. I still got it :)
function findNodePathFromParent(rootNode, childToFind) {
  if (!rootNode || !childToFind) {
    console.log('rootNode', rootNode);
    console.log('childToFind', childToFind);
    return '';
  }

  // 3, 4, 0,
  var pathArr = [];
  var curNode = childToFind;

  // traverse up the tree from startingNode until we reach rootNode
  while (curNode !== rootNode) {
    // get birth # (relative to siblings)
    var j = 0;
    while (curNode.previousSibling) {
      curNode = curNode.previousSibling;
      j++;
    }

    pathArr.push(j);

    // go to the next parent
    curNode = curNode.parentNode;
  }
  //
  // at end, reverse the array so we get the top-down path instead of bottom up
  return pathArr.reverse();
}

function findNodeFromPath(rootNode, path) {
  var node = rootNode;

  // FIXME: more clear as while loop?
  for (var i = 0; i < path.length; i++) {
    var childNumber = path[i];
    // get the next childNode
    node = node.childNodes[childNumber];
  }

  //  when we're out of path, then return the found node
  return node;
}

document.addEventListener('selectionchange', () => {
  // debugger;
  var selection = document.getSelection();
  console.log('CARET MOVED: from evt listener!', selection);

  // TODO: Debounce this or throttle it... or just call it right before the transform... Maybe move it there?
  // Maybe we capture all these events in a queue and then we only let the last one thruogh when highlight is called...
  // TODO: GOLD. let's do that eventually... basically we just need to save and restore before/after render, bc that's
  // when things get wiped...
  // insertMarker(selection.anchorNode, selection.anchorOffset);
});

var marker;

function insertMarker(node, splitOffset) {
  console.log('node', node);
  // FIXME:
  // BUGS:
  // - deletion with backspace breaks this... Need to guard against that...

  // if it's detached it won't have a parentNode
  if (marker && marker.parentNode)
    marker = marker.parentNode.removeChild(marker);

  // if we're not on a textnode, then bail
  if (!node.splitText) return;

  // will this always be a text node?
  // split the text node into 2 nodes (perfect for insertions)
  // offset = where to split the textNode
  var split = node.splitText(splitOffset); // returns a node where the split happened

  // if (!marker) {
  marker = document.createElement('span');
  marker.id = 'caret-marker';
  // interesting that changing pos to absolute introduces a bunch of other problems...
  // Exp for later: see if we can replace the cursor with our own custom one entirely...
  // marker.innerHTML = '|';
  // Weird that changing position affects if I can move to the right...
  // marker.style="position: absolute; color: red;"
  marker.style = 'display:none;'; // TODO: need to measure, but I THINK this improves the perf...
  // }

  // FIXME: add fix for case when you go from moving left, to moving right... At that point there's a error because we don't want to move
  // add some sort of check there...

  // skip the marker OR we could just remove it first...
  console.log('split', split);
  console.log('split-name', split.nodeName);
  console.log('is stame', split.parentNode);
  // when you are moving from left, to swtich to moving to right, it tries to replace the marker with itself. In this case, move to next el.
  // other fix would be to simply remove the caret marker from dom first...
  if (split.parentNode.id === 'caret-marker') {
    node.parentNode.appendChild(marker, split);
    // split = split.parentNode.nextSibling; //
  } else {
    node.parentNode.insertBefore(marker, split);
  }

  console.log('split2', split);

  // FIXME: should  we collapse the text nodes after we  move it?
  // https://developer.mozilla.org/en-US/docs/Web/API/Text/splitText

  // if we use a live node, it'll auto remove it from other spot...

  // if I move right, should I insetrAfter?

  // glue the split nodes back together.
  node.parentNode.normalize();
}
