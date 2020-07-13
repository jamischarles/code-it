/**
 * Contains the local STATE store.
 * Learning: All my work with redux and react ideally positions me to work on this, or at least to solve it using these patterns...
 */

// TODO: consider using a proxy obj to listen for state changes on state obj and see which nodes change so yuo can listen to just those...

// BUGS TO FIX:
// [ ]cmd backspace doesn't work... properly...
// Q:can we take some of these more complex UI actions and just listen for it?
// and say "hey you just deleted the whole line. Or from caret to start of line...
// and then tombstone all those?
// [ ] If first inserted char ID is missing, no other operations anchored to that first one will succeed.
//  A: Fallback: if charID ref is not found, insert at beginning of row...
//  [] add an ID to a row so we never have an invalid anchor?
//
//
// Next:
// - add collab support for single line edits
// - start adding multi line changes in...
// - add caret visualiztions
// - show to maxwell...
// Q: Is this change(s) bigger than my appetite for the work?
// How can I adjust for that?
//
var initPhase = true;
setTimeout(() => (initPhase = false), 2000);

import {getCharPosFromSelectionObj, getActiveRowEl} from './prism_exp';
import {getCharAtPosition} from './render';
import {getSelfPeerId} from './firebase';

// state starts as empty...
// var state = {};

// TODO: consider using lodash.uniq with for enforcing unique keys, or we can just an obj instead...
// We just need consistent ordering. Do we get that with obj? We do NOT. Obj does NOT guarantee key order...
var state = {
  // rows: [[]], // each row will eventually probably need an ID so we can track and tombstone it as well...
  content: [], //including tombstoned items
  liveContent: [], //no tombstoned items
  peers: [],
  // caret: {},
  // let's punt until we need  that...
  // rows: [[{value: 'f', id: 'a1'}, {value: 'u', id: 'a2'}]],
};

// Do I even need this?
// update this with each insertion / tombstone purge
var charsById = {};

var charCounter = 0;

// immutable snapshots of state over time
var history = [];

// functions that will listen and fire...
var subscribers = [];
var peerSubscribers = []; // only listen to state.peers changes

// queue of operations to be sent
// FIXME: do we need this?
var opQueue = [];

// delete. only use this for testing... or maybe we need this for a buffer
// document.addEventListener('selectionchange', () => {
//   console.log('selection', document.getSelection());
// });

// subscribe to state updates (using simple evt emitter here...)
// todo: Add unsubscribe
export function subscribe(fn) {
  subscribers.push(fn);
}

function callSubscribers() {
  subscribers.forEach(fn => {
    fn(state);
  });
}

// FIXME: make this more automagical
// listens just to state.peers changes...
export function subscribeToPeers(fn) {
  peerSubscribers.push(fn);
}

function callPeerSubscribers() {
  // console.log('calling Peers subs', state.peers);
  peerSubscribers.forEach(fn => {
    // console.log('fn', fn);
    fn(state.peers);
  });
}

export function getState() {
  return state; // Should we freeze this? Make it immutable? Return a copy?
}

export function getOpQueue() {
  return opQueue;
}

export function flushOpQueue() {
  opQueue = [];
}

// FIXME: change this name... genCharId() is misleading since now the fn is doing too many things...
// or refactor this into several functions...
function genCharId(remoteID) {
  // IF we pass in a remote id for a node that's already been inserted, then we have 2 scenarios
  // 1) Peer is different from ours. ie: a1 != b1. Use that ID and insert with that
  // 2) Peer is same as ours. a5 = a1. This means we need to keep the ID, but increment our ID counter so we don't reuse that ID.
  //
  //

  if (remoteID) {
    return remoteID;
  }

  var count = charCounter++;
  return getSelfPeerId() + '|' + count;
}

// these are all util functions... consider moving them to a utils file...
export function getCharById(charId) {
  return charsById[charId];
}

// returns the first live el
// if nothing returned, assume there are no live chars
export function getFirstLiveChar(lineNum) {
  var firstLiveChar = state.rows[lineNum].find(x => !x.tombstone);
  return firstLiveChar;
}

// returns the row obj...
// FIXME: add IDs to rows so we can easily grab by refs...
// or we should just store a JS ref to the live nodes...
// export function getRowFromLineNum(rowNum) {
//   return state.rows[rowNum];
// }

// TODO: consider storing the line & pos with the char...
export function getPositionFromChar(id) {}

// APPROACH #1 - Capture keystrokes (OR dom mutations) and turn that into operations.
// I think this approach necessitates a controlled component. Too high of a risk of bugs creeping in. If we dogfood it, then it's like a repl and
// the chance of bieng accurate will dramatically be higher...
// This will also ensure that the local state will be guaranteed to be reflected in the UI. BOOM. I can see why react chose this model...
// Let's go for that approach...

// LATER: consider collapsing redundant operations
// INSERT
// DELETE (tombstone)
// MOVE (DELETE, INSERT)
// REPLACE (same char, same id get's reassigned)
export function generateSimpleOperationFromKeystroke(e, pos) {
  // start with simple, 1 char changes. Then we'll focus on selected operations...
  // Then look at multi line operations and PASTE operations

  // console.log('generateOperationFromKeystroke():e', e);
  // console.log('generateOperationFromKeystroke():pos', pos);
  // is this a mutation?

  var BACKSPACE = 8;
  var ENTER = 13;
  var TAB = 9;
  var key = e.keyCode;
  // console.log('e', e);
  //

  // OPT IN
  // ONLY commands / chars we want to allow through are:
  // "BACKSPACE", "ENTER", and single chars
  // anything else get's killed right here
  // FIXME: could just replace the else statement below with a if key.length check and don't have an else...
  // if (key != BACKSPACE && key != ENTER && e.key.length > 1) return;

  // cancel the default event behavior for the keys we're handling manually
  // FIXME: is this even needed?

  // if cmd is being held down or pressed, don't insert it
  // handle cut
  // handle paste
  // this is fired from cut & paste event handlers...
  if (e.type === 'paste') {
    // turn this into many ops, or a single one and have state manage it...
    // latter

    // FIXME: can / should we simplify this? Do we even need the latter?
    // // FIXME: do we even need to listen for paste event? Or should we send this at a highler level... For now... leave this in. Nice to have a hook if we need it...
    let pasteText = e.clipboardData.getData('text');
    // let pasteText = (e.clipboardData || window.clipboardData).getData('text');

    applyOperationToState('insert', pos, pasteText);
    console.log(`##PASTE: ${pos}, ${pasteText}`);
    e.preventDefault();

    // do nothing

    // handle paste
    //

    // block all other meta keys
  } else if (e.metaKey) {
    // can't prevent this on keyDown, bc it'll block paste, copy, cut ops etc...
    // e.preventDefault();
  } else if (key === BACKSPACE) {
    // console.log('DELETE:', `${pos.line}:${pos.charPosition}`);
    // TODO: Make sugar for delete(0), insert(1, 'h','e');
    // debugger;
    applyOperationToState('delete', pos);
    e.preventDefault();
    // swap ENTER for \n
  } else if (key === ENTER) {
    applyOperationToState('insert', pos, '\n');
    e.preventDefault();
  } else if (key === TAB) {
    applyOperationToState('insert', pos, '\v');
    e.preventDefault();
  } else {
    // // ignore any key that isn't a single char that also wasn't handled above
    if (e.key.length < 2) {
      applyOperationToState('insert', pos, e.key);
      e.preventDefault();
    }
    // console.log('INSERT:', `${pos.line}:${pos.charPosition}:${e.key} `);
  }
  // what keystroke
  // WHERE
  //
  //
  // e.preventDefault();
}

// FIXME: move  to utils
export function getSelectionRangeBoundaries() {
  var selObj = window.getSelection();
  // var selRange = selObj.getRangeAt(0);
  // console.log('selObj', selObj);
  // console.log('selObj:1', selObj.anchorOffset);
  // console.log('selObj:2', selObj.focusOffset);
  // console.log('selRange', selRange);

  // FIXME: extract into separate util?
  // if some text is selected (aka selection is NOT collapsed)
  // got the charPosition for start and end of selection so we can generate delete ops on the selection
  // bc we'll have CUT (DELETE) and REPLACE (delete, and insert)
  //
  var isTextSelected = !selObj.isCollapsed;

  if (!isTextSelected) return false;

  var startingRowEl = getActiveRowEl(selObj.anchorNode);
  var endingRowEl = getActiveRowEl(selObj.focusNode);
  //start/end might be rotated depending on which side you start the selection from
  var startPos = getCharPosFromSelectionObj(
    startingRowEl,
    selObj.anchorNode,
    selObj.anchorOffset,
  );
  var endPos = getCharPosFromSelectionObj(
    endingRowEl,
    selObj.focusNode,
    selObj.focusOffset,
  );

  // ensure start is lower number (because we don't care which side (or row) started selection for our use cases)
  //
  // 1) lower row must be start
  // 2) if same row, lower charPos must be start
  //
  //

  // default values allow us to ignore half the use cases...
  var returnVal = {
    start: startPos,
    end: endPos,
  };

  // if start/end are on same line AND start is later on line, swap start/end
  if (
    startPos.line === endPos.line &&
    startPos.charPosition > endPos.charPosition
  ) {
    returnVal = {
      start: endPos,
      end: startPos,
    };
  }

  // if start is on a lower line than start swap start/end
  if (startPos.line > endPos.line) {
    returnVal = {
      start: endPos,
      end: startPos,
    };
  }

  return returnVal;
}

// reducer type thing
// user AFTER a char as the marker, not before...
// so typing at 0 should use START of parentNode as the marker, and not the first char...
// typing at end of line should use the last char as marker, and not END of line...
// if it's a remote op, don't add it to the opQueue... (causes infinite loop)
function updateState(op, isRemoteOp) {
  debugger;
  // official ones we should log.
  // Always log the OP, opt in/out to before/after...
  // BEFORE state
  // OP
  // AFTER state
  console.log('####updateState:', op);

  // FIXME get this from charID if possible later...
  // TODO: we need to give rows IDs too...
  // TODO: have reparate counter for rows, but start it with r. eg: ra1
  // var row = op.meta.row;

  var {type} = op;
  var charsToInsert = [];

  // loop through the row...
  // TODO: consider having separate fn for each row we process...
  var caret;
  // var insertionID;
  var content = [];
  var liveContent = [];

  // inserting by relative charID is the key to having this op be commutative (WIN)
  // and if we check if the id has been inserted we get idempotency (WIN)
  // debugger;
  // FIXME: consider replacing this with indexOf, findIndex() and slice etc and other modern fns. This perf win likely isn't
  // worth it and we're giving up readability...
  // FIXME: replace this with fewer loops eventually...
  // if needed...
  // find char where we need to perform op

  // insert our new char
  // FIXME: extract these into separate fns?
  if (type === 'insert') {
    // fill in prior array items until char we need
    // newRow = currentRow.slice(0, index + 1); // +1 because end not included by default 0,0 would NOT include 0
    var insertAfter = op.insertAfter;

    charsToInsert = op.insertChars
      .map(char => {
        // if id already exists, use that, else generate a new one tagged by this peer
        char.id = genCharId(char.id); // FIXME: we can simplify this and pull the checking logic out of that function... and check here and simply gen there

        char.insertAfter = char.insertAfter || insertAfter; // if remoteOp this'll be set.

        // failsafe... if char already exists, don't create it...
        // FIXME: Do we need this?
        if (charsById[char.id]) {
          return false;
        }

        charsById[char.id] = char;

        // for the next pass we'll want to use the prior char, since these are all being inserted sequentially
        insertAfter = char.id;

        return char;
      })
      .filter(char => char); // anything truthy gets kept

    // if ID already exists (because other peer created it, use that...)
    // insertionID = genCharId(op.charId);

    // var newChar = {
    //   value,
    //   id: insertionID,
    // };

    // insert new char
    // newRow.push(newChar);

    // if (charsById[insertionID]) {
    //   return;
    // }
    // charsById[insertionID] = newChar;

    // apply any other array items that exist after
    // FIXME: Is there a better es6 operator for INSERT at i in array?
    // newRow.push(...currentRow.slice(index + 1, currentRow.length)); // need to spread it on so we don't get a nested array
  }

  // delete. Tombstoned by...
  if (type === 'delete') {
    // var index = currentRow.findIndex(el => el.id === op.at);

    // for delete, at: [] bc it could be a range of deletions
    op.deleteChars.forEach(id => {
      var char = charsById[id];
      if (!char)
        return console.log(`WARNING: cannot tombstone ${id}. Char is missing.`); // if char is somehow missing just ignore it...
      char.tombstone = true;
      delete char.pos; // no position since char is now dead
    });

    // find the first char marked for deletion so we'll know where to place the caret
    // FIXME: Handle logic here for "findCaretPos  after deletion"
    // can't  use liveContent here because me may need to grab a tombstoned char
    var focusedItem = getLiveCharFromDeadOne(op.deleteChars[0]);

    // TODO: rip the deleted item out and replace the liveContent array...
  }

  // if there's no char after, it means it's the first char in the editor
  if (op.type === 'insert' && !op.insertAfter) {
    content.push(...charsToInsert); // spread onto array so we don't get nested arrays
    liveContent.push(...charsToInsert);
  }

  // single loop should be better for perf than alternatives
  for (var i = 0; i < state.content.length; i++) {
    var curChar = state.content[i];
    if (!curChar.tombstone) {
      liveContent.push(curChar);
    }

    content.push(curChar);

    // find el AFTER which to insert new char
    if (curChar.id === op.insertAfter && op.type === 'insert') {
      // insert the new char
      content.push(...charsToInsert);
      liveContent.push(...charsToInsert);
    }
  }

  // if empty array, (or only dead chars in array) insert newchar (because loop above won't be executed)
  // if (op.type === 'insert' && liveCharCounter === 0) {
  //   newRow.push(newChar);
  // }

  // FIXME: see if we can avoid this extra loop...
  // maybe we can do this as part of the operation
  // OR even better, figure out a way to do this w/o extra loops...
  // maybe we only do this looping during READ of the where the caret should be...
  // loop through the whole thing and fix position markers (ignore tombstoned items)
  // FIXME: refactor this to avoid this work...
  // if (newRow) {
  //   var counter = 0;
  //   // debugger;
  //   newRow.forEach((item, i) => {
  //     if (!item.tombstone) counter++;
  //     item.pos.charPosition = counter;
  //   });
  // } else {
  //   currentRow.forEach((item, i) => {
  //     if (!item.tombstone) counter++;
  //     item.pos.charPosition = counter;
  //   });
  // }

  // // update the new caret position
  // var caret = {
  //   // client: getSelfPeerId(),
  //   // after: insertionID || op.after, // FIXME: this will cause bugs when sent to other peers. esp for delete...
  //   afterChar: newChar || focusedItem, // FIXME: need better new name for nowHaveCaret here
  //   // line: currentRowIndex, // FIXME: Try to remove? Need this as a fallback when we don't have a char (empty line)
  // };

  // if remote op, don't change self caret position
  // FIXME: consider handling delete here if they delete where the caret is...
  // must be after state because it
  if (!isRemoteOp) {
    var lastCharInserted = charsToInsert[charsToInsert.length - 1];
    caret = updateOwnCaretPos(lastCharInserted || focusedItem);
  }

  // if peer deleted the char our caret is attached to, update caretPos so it can fetch the adjacent live char to attach caret to
  // FIXME: maybe just always update caret... and combine this with logic above...
  // debugger;
  // console.log('##4 isRemoteOp', isRemoteOp);
  // console.log('##4 state.caret', state.caret);
  if (
    isRemoteOp &&
    (state.caret && state.caret.afterChar && state.caret.afterChar.tombstone)
  ) {
    // console.log('##4inside');
    // FIXME: flatten state.caret already
    caret = updateOwnCaretPos(state.caret.afterChar);
  }

  state = {
    ...state,
    content,
    liveContent,
    caret: caret || state.caret, // new caret pos or old caret pos
  };

  // save the operation we just applied into the opqueue so we can send it to others...
  // IF not remote operation, then push it to opQueue
  // console.log('isRemoteOp', isRemoteOp);
  if (!isRemoteOp) {
    // attach the ID of the el just inserted to the OP so we can send it to other peers
    // charId is the ID of the char which is assigned at insertion / creation so we have a unique ID for each char ever created
    // op.charId = op.charId || lastCharInserted.id; // naive assumption: only time op.charId will be missing is when we
    opQueue.push(op);
    // console.log('OP Inserted to Queue:', op);
  }

  // console.log('opQueue', opQueue);
  // TODO: see  if we can  batch all this somehow? Maybe with throttle, or debounce?
  callSubscribers();
}

// find earlier sibling that hasn't been tombstoned
// by charId?
// function findFirstPreviousLiveSibling() {
//
// }

//FIXME: use startSel, endSel to restore selection...
//id can be string ID or char Obj
export function updateOwnCaretPos(idOrObj, startSel, endSel) {
  // ONLY time idOrObj should be undefined is if after deletion, we are at very beginning of editor (0:0)
  var charObj = idOrObj;

  if (typeof charObj === 'string') {
    charObj = getCharById(charObj);
  }

  // if dead char, get the prior sibling
  // this will be neeeded if a peer deletes the char our caret is on
  if (charObj && charObj.tombstone) {
    charObj = getLiveCharFromDeadOne(charObj.id);
  }

  state.caret = {
    // stored as the charObj...
    // does this need to be getLiveCharFromDeadOne? or at least a check here if the char is dead...?
    // FIXME: seriously consider just collapsing this into state.caret... Would make handling caret logic simpler
    afterChar: charObj,
  };

  // fire caret saved event here...
  console.log('## own caret pos updated', state.caret);
  // returns new caret obj
  return state.caret;
}

// returns a live char if you pass a dead one (basically closest living sibling to the left)
// useful to determine where the caret should be after a deletion etc...
export function getLiveCharFromDeadOne(deadCharId) {
  var index = state.content.findIndex(el => el.id === deadCharId);

  var j = index;
  // travel backwards until we find the first non-tombstoned char
  while (j > -1) {
    var focusedItem = state.content[j];
    if (!focusedItem.tombstone) break;
    j--;
    // console.log('while');
  }

  // if we go to beginning and they are all tombstoned, then return undef
  if (focusedItem && focusedItem.tombstone) focusedItem = undefined;

  return focusedItem;
}

// move the caret for the current peer
// should this be a manual move or a tracking?
// for now... let's make this manual...
// we'll  def need this after we merge remote state and perform deletions or insertions.
// IN general we'll want the caret to be sticky and STICK to a charID (non-tombstoned char).
function updateCaretPosition(id) {}

// returns an array of chars that need to be deleted (tombstoned)
// TODO: for selection testing you need to test rtl vs ltr. It makes a difference!
// FIXME: simpilfy the logic in here
function generateDeleteOperationFromSelection(startPos, endPos) {
  debugger;
  var charIDsToDelete = [];
  // look up all the char ids included in range between startPos and endPos
  //FIXME: remove some of these...?
  var startLine = startPos.line;
  var startIndex = startPos.charPosition;

  var endLine = endPos.line;
  var endIndex = endPos.charPosition;

  // loop through lines (inclusive) Lines 2-4 should include line 4?
  for (var j = startLine; j <= endLine; j++) {
    var curLine = j;

    // FIXME: simplify this logic. Maybe a while loop?
    var startCharPos = 0;
    // if we're on the starting line, startPos should be where the selection starts
    if (curLine === startLine) startCharPos = startIndex;

    var endCharPos = 1000000000; // super high so we go until no more chars on that row...
    // if we're on the ending line, endPos should be where the selection ends
    if (curLine === endLine) endCharPos = endIndex;

    // keep growing until there's no more char (means we reached end of row)
    for (var i = startCharPos; i < endCharPos; i++) {
      var char = getCharAtPosition({line: curLine, charPosition: i}, true);
      if (!char) break;
      charIDsToDelete.push(char.id);
    }

    // loop while there are still chars on row. When we run out, it'll go to next line...
    // while (curChar) {
    //   charIDsToDelete.push(curChar.id);
    //   curPos++;
    //   curChar = getCharAtPosition({line, charPosition: curPos}, true);
    // }

    // loop through chars on line
    // for (var i = startIndex; i < endIndex; i++) {
    //   var char = getCharAtPosition({line, charPosition: i}, true);
    //   if (!char) continue; // Is this even needed?
    //   charIDsToDelete.push(char.id);
    // }
  }

  // FIXME: abstract this so we generate these consistently from both places...?
  return {
    type: 'delete',
    deleteChars: charIDsToDelete, // ids of chars to tombstone
  };
}

//
// Proper operation with data needed (with transformation function, or should we use a reducer type pattern?
// we can think of this like an action...
// because really we're modifying state...
// we use the existing state to generate this operation...
// we provide any needed context that's needed...
//
// pos could be obj or array (if there's a start/end range). Only happens for deletion markers. Bc insertion always happens at single spot...
function generateOperation(opType, pos, chars) {
  var charsToInsert;
  // operation that can be sent as a string, or can just be applied locally
  // should contain refrences to existing char nodes...
  //
  //
  // FIXME: change this to allow for mulpilte operations to be returned
  // DELETE range. and DELETE(a1,f3,f5) , INSERT
  // SHould this splitting out happen in fn that calls this fn?

  // what row:pos? That way we can look up the thing to use as a reference point...
  var {charPosition, line} = pos;

  var char = getCharAtPosition(pos);
  var charId = char && char.id;

  if (opType === 'delete') {
    return {
      type: 'delete',
      deleteChars: [charId],
    };
  }

  // we already bailed on delete
  // INSERT use case #################3

  // turn char string into char array, then replace with obj for each char
  var charsToInsert = chars.split('').map(char => {
    return {
      value: char,
    };
  });
  chars;

  // INSERTION
  return {
    type: opType,
    // FIXME: change to insertAfter
    insertAfter: charId,
    insertChars: charsToInsert,
    // possibly useful that isn't specificy part of teh obj
    // FIXME: remove this later if possible.  hack for now to get it working properly...
    // meta: {
    //   row: line - 1,
    // },
    // id
  };
}
//
// opName
// pos
// ?chars
// TODO: insert should create a new entry in charsById too...
// TODO: consider storing the position of the thing in that obj too...
function applyOperationToState(opName, pos, chars) {
  var operations = [];
  // chars to insert (just one char for now, array later)
  // applyOperationToState('insert', pos, [...])
  //
  // console.log(`## ${opName}:`, `${pos.line}:${pos.charPosition}, ${chars}`);

  // will return false if no selection
  var {start, end} = getSelectionRangeBoundaries();

  // if there's selected text, generate a delete action for all the chars in the selection
  // that will be exectued on INSERT (replace) and DELETE
  // is there textSelected?
  if (start && end) {
    var deleteOperation = generateDeleteOperationFromSelection(start, end);
    operations.push(deleteOperation); // delete the selection
  }

  // if ranged delete from selection (no insert), do NOT generate another deletion, else too many chars will be deleted
  if (opName === 'delete' && operations.length > 0) {
    // do nuthin
  } else {
    var op = generateOperation(opName, pos, chars);

    // if delete op and no charID, bail, because it means we're trying to delete an empty char at beginning of editor
    if (op.type === 'delete' && !op.deleteChars[0]) return;

    operations.push(op);
  }

  // loop through the operations we need to apply
  operations.forEach(op => updateState(op, false));

  // all done applying updates. fire any subscribed events... to re-render the DOM
  // callSubscribers();
}

// this is for the actual state values...
function createRow() {
  var rowContent = new Set();

  return {value: rowContent, tombstone: false};
}

// take remote operation from another peer and merge it into my update stream and apply it...
export function mergeRemoteOperation(op) {
  // FIXME: apply on page load even from own peer, but not after that...
  // TODO: set a flag to see if we're during init...
  // MAYBE use timestamp of events coming in ???
  // or we can compare
  // FIXME: hacky... for now... let's just see if we're empty...
  // we'll just wait for 2s for all events to stream in... Then we'll call it good...
  // and then apply all updates streaming in...
  //

  if (op.peer === getSelfPeerId()) {
    console.log('## IGNORING REMOTE op from self:', op);
  } else {
    console.log('## REMOTE op to apply:', op);
    updateState(op, true);
  }

  // TODO: ensure updating state from remote doesn't fire more FB updates (INFINITE LOOP)
  // updateState(op);
  // re-render the UI
}

// ############################### THROWAWAY CODE #############################

// APPROACH #2 - Save state and diff it and generate operations using edit distance algos...

// save what's in the UI to a state snapshot (in prep for sending() or merging())...
// Q: Do we even need to tie those together? I suppose we need to commit local changes first so remote changes don't override local ones...
export function saveCurrentEditorToState(editorNode) {
  // get all the rows (TODO: they'll need IDs or data-attrs to be able to sync up tombstoned rows with changes happening...)
  // Q: Do we really need that? We should be able to match of content? FIXME: figure this out... Just try one approach and see what problems we run into...
  // console.log('SAVE the ship');

  var rowsContainer = editorNode.querySelector('.rows');

  // array of strings (1 string for each row
  var snapshot = [];

  Array.from(rowsContainer.children).forEach(item => {
    snapshot.push(item.textContent);
  });

  // we have the editor state, by lines... now what...
}

// expect 2 arrays we can diff
// this will return an obj that will tell us the diff
// We can use the diff to generate operations which will get A to B.
function diffSnapshots(a, b) {}

function generateOperationsFromDiff() {}

// peer functions...
export function updatePeerState(newState) {
  // got this directly from FB
  state.peers = newState;
  // state.peers.online[c50].caret

  console.log('STATE: peer state updated!:', state.peers);
  callPeerSubscribers();
}
