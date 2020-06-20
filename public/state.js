/**
 * Contains the local STATE store.
 * Learning: All my work with redux and react ideally positions me to work on this, or at least to solve it using these patterns...
 */

import {getCharPosFromSelectionObj} from './prism_exp';

// state starts as empty...
// var state = {};

// TODO: consider using lodash.uniq with for enforcing unique keys, or we can just an obj instead...
// We just need consistent ordering. Do we get that with obj? We do NOT. Obj does NOT guarantee key order...
var state = {
  rows: [[]], // each row will eventually probably need an ID so we can track and tombstone it as well...
  carets: [],
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

// queue of operations to be sent
// FIXME: do we need this?
var opQueue = [];

// delete. only use this for testing... or maybe we need this for a buffer
document.addEventListener('selectionchange', () => {
  console.log('selection', document.getSelection());
});

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

export function getState() {
  return state; // Should we freeze this? Make it immutable? Return a copy?
}

function genCharId() {
  var id = charCounter++;
  var client = 'a';
  return client + id;
}

// pass in whatever thing we need wether it's ID or position...
function getCharAtPosition() {}

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
  var key = e.keyCode;
  // console.log('e', e);
  //

  if (key === BACKSPACE) {
    // console.log('DELETE:', `${pos.line}:${pos.charPosition}`);
    // TODO: Make sugar for delete(0), insert(1, 'h','e');
    applyOperationToState('delete', pos);
  } else {
    applyOperationToState('insert', pos, e.key);
    // console.log('INSERT:', `${pos.line}:${pos.charPosition}:${e.key} `);
  }
  // what keystroke
  // WHERE
  //
  //
  e.preventDefault();
}

// FIXME: move  to utils
function getSelectionRangeBoundaries() {
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

  var rowEl = getActiveRowEl();
  //start/end might be rotated depending on which side you start the selection from
  var startPos = getCharPosFromSelectionObj(
    rowEl,
    selObj.anchorNode,
    selObj.anchorOffset,
  );
  var endPos = getCharPosFromSelectionObj(
    rowEl,
    selObj.focusNode,
    selObj.focusOffset,
  );

  // ensure start is lower number (because we don't care which side started selection for our use cases)
  //
  if (startPos.charPosition < endPos.charPosition) {
    return {
      start: startPos,
      end: endPos,
    };
  } else {
    return {
      start: endPos,
      end: startPos,
    };
  }
}

// reducer type thing
// user AFTER a char as the marker, not before...
// so typing at 0 should use START of parentNode as the marker, and not the first char...
// typing at end of line should use the last char as marker, and not END of line...
function updateState(op) {
  console.log('####updateState:', op);

  // FIXME get this from charID if possible later...
  // TODO: we need to give rows IDs too...
  // TODO: have reparate counter for rows, but start it with r. eg: ra1
  // var row = op.meta.row;

  var {type, at, value} = op;

  // loop through the row...
  // TODO: consider having separate fn for each row we process...
  var currentRowIndex = 0;
  var currentRow = state.rows[currentRowIndex];
  // var newRow = [];
  var insertionID;
  //
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

    insertionID = genCharId();
    var newChar = {
      value,
      id: insertionID,
      // FIXME: consider storing just line here, because charPosition will become stale as soon as another insert happens
      // TODO: remove charPosition because that'll become stale as soon as there's another insertion...
      // Will we have the same problem with lines? Probably... TODO: Fix that later...
      pos: {line: currentRowIndex, charPosition: 0}, // default to 0. Will be updated later.
    };

    // insert new char
    // newRow.push(newChar);

    charsById[insertionID] = newChar;

    // apply any other array items that exist after
    // FIXME: Is there a better es6 operator for INSERT at i in array?
    // newRow.push(...currentRow.slice(index + 1, currentRow.length)); // need to spread it on so we don't get a nested array
  }

  // delete. Tombstoned by...
  if (type === 'delete') {
    // var index = currentRow.findIndex(el => el.id === op.at);

    // for delete, at: [] bc it could be a range of deletions
    op.at.forEach(id => {
      var char = charsById[id];
      char.tombstone = true;
      delete char.pos; // no position since char is now dead
    });

    // currentRow[index].tombstone = true;
    // delete currentRow[index].pos; // no position since char is now dead

    // TODO: we need to find the char where the caret should be now... Previous sibling to tombstoned char...
    // var item = currentRow[index];
    // debugger;

    // find the first char so we'll know where to place the caret
    var index = currentRow.findIndex(el => el.id === op.at[0]);

    var j = index;
    while (j > -1) {
      var focusedItem = currentRow[j];
      if (!focusedItem.tombstone) break;
      j--;
      console.log('while');
    }
    if (focusedItem.tombstone) focusedItem = undefined;
  }

  // loop through whole row
  var newRow = [];
  var liveCharCounter = 0; // count only live chars that haven't been tombstoned

  // if there's no char at, it means it's the first char that needs to be inserted
  if (op.type === 'insert' && !op.at[0]) {
    newChar.pos.charPosition = liveCharCounter;
    newRow.push(newChar);
    liveCharCounter++;
  }

  // single loop should be better for perf than alternatives
  for (var i = 0; i < currentRow.length; i++) {
    var curChar = currentRow[i];
    if (!curChar.tombstone) {
      curChar.pos.charPosition = liveCharCounter; // update position of existing char (discounting any tombstoned chars)
      liveCharCounter++;
    }

    newRow.push(curChar);

    // find el AFTER which to insert new char
    if (curChar.id === op.at[0] && op.type === 'insert') {
      // insert the new char
      newChar.pos.charPosition = liveCharCounter;
      newRow.push(newChar);
      liveCharCounter++; // increment live counter after insertion
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

  // update the new caret position
  var caret = {
    client: 'a',
    after: insertionID || op.at, // FIXME: this will cause bugs when sent to other peers. esp for delete...
    afterChar: newChar || focusedItem, // FIXME: need better new name for nowHaveCaret here
    line: currentRowIndex, // FIXME: Try to remove? Need this as a fallback when we don't have a char (empty line)
  };

  state = {
    ...state,
    rows: [newRow], // always add a new row item after update...
    carets: [caret],
  };

  console.log('state', state.rows[0]);
}

// find earlier sibling that hasn't been tombstoned
// by charId?
// function findFirstPreviousLiveSibling() {
//
// }

// gives the exact row/id where we can find the element
function findPosById(id) {
  state; // FIXME: make this pure?
  return {row: 0, index: 0};
}

// move the caret for the current peer
// should this be a manual move or a tracking?
// for now... let's make this manual...
// we'll  def need this after we merge remote state and perform deletions or insertions.
// IN general we'll want the caret to be sticky and STICK to a charID (non-tombstoned char).
function updateCaretPosition(id) {}

export function getActiveRowEl() {
  // get caret
  var sel = window.getSelection();
  var rowEl;

  // current textNode at cursor (works unless row is blank. Then it can be at a elNode
  var aNode = sel.anchorNode;
  // if you are a textNode
  if (aNode.nodeType === 3) {
    rowEl = aNode.parentNode.closest('.row');
  } else {
    rowEl = aNode.closest('.row');
  }

  return rowEl;
}

// returns an array of chars that need to be deleted (tombstoned)
function generateDeleteOperationFromSelection(startPos, endPos) {
  var charIDsToDelete = [];
  // look up all the char ids included in range between startPos and endPos
  //
  // FIXME: For now, assume that start & end are on same line... We'll need to fix this later...
  var {line} = startPos;

  var startIndex = startPos.charPosition;
  var endIndex = endPos.charPosition;

  // new array of row minus dead chars
  var liveCharsOnRow = state.rows[line].filter(x => !x.tombstone);

  for (var i = startIndex; i < endIndex; i++) {
    charIDsToDelete.push(liveCharsOnRow[i].id);
  }

  return {
    type: 'delete',
    at: charIDsToDelete, // ids of chars to tombstone
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
  // operation that can be sent as a string, or can just be applied locally
  // should contain refrences to existing char nodes...
  //
  //
  // FIXME: change this to allow for mulpilte operations to be returned
  // DELETE range. and DELETE(a1,f3,f5) , INSERT
  // SHould this splitting out happen in fn that calls this fn?

  // what row:pos? That way we can look up the thing to use as a reference point...
  var {charPosition, line} = pos;

  // is anything selected? if it is, generate

  // TODO: take tombstoning into account
  // Filter out the tombstoned objects
  // TODO: add safe getter...
  //
  //

  // ignore tombstoned lines and chars when counting
  // filter out tombstoned items
  // debugger;
  var charId =
    state.rows[line][charPosition - 1] &&
    state.rows[line].filter(x => !x.tombstone)[charPosition - 1].id;
  console.log('##charId', charId);
  // state;
  // INSERT('a2', 'H') // optioal third is going to be  the ID of the newChar to be inserted... if it comes from remote we want to prefill that one..
  return {
    type: opType,
    at: [charId], // for deletions it can be an array of chars. For insert it's only one, but let's keep it consistent...
    value: chars,
    // possibly useful that isn't specificy part of teh obj
    // FIXME: remove this later if possible.  hack for now to get it working properly...
    meta: {
      row: line - 1,
    },
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
  console.log(`## ${opName}:`, `${pos.line}:${pos.charPosition}, ${chars}`);

  // will return false if no selection
  var {start, end} = getSelectionRangeBoundaries();
  console.log('startPos', start);
  console.log('endPos', end);

  // if there's selected text, generate a delete action for all the chars in the selection
  // that will be exectued on INSERT (replace) and DELETE
  // is there textSelected?
  if (start && end) {
    var deleteOperation = generateDeleteOperationFromSelection(start, end);
    operations.push(deleteOperation); // delete the selection
  }

  var op = generateOperation(opName, pos, chars);

  operations.push(op);
  console.log('##operations', operations);

  // loop through the operations we need to apply
  operations.forEach(op => updateState(op));

  // all done applying updates. fire any subscribed events... to re-render the DOM
  callSubscribers();
}

// APPROACH #2 - Save state and diff it and generate operations using edit distance algos...

// save what's in the UI to a state snapshot (in prep for sending() or merging())...
// Q: Do we even need to tie those together? I suppose we need to commit local changes first so remote changes don't override local ones...
export function saveCurrentEditorToState(editorNode) {
  // get all the rows (TODO: they'll need IDs or data-attrs to be able to sync up tombstoned rows with changes happening...)
  // Q: Do we really need that? We should be able to match of content? FIXME: figure this out... Just try one approach and see what problems we run into...
  console.log('SAVE the ship');

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

// this is for the actual state values...
function createRow() {
  var rowContent = new Set();

  return {value: rowContent, tombstone: false};
}

function merge() {}

// Select the node that will be observed for mutations
const targetNode = document.getElementById('editor');

// Options for the observer (which mutations to observe)
const config = {attributes: true, childList: true, subtree: true};

// Callback function to execute when mutations are observed
const callback = function(mutationsList, observer) {
  console.log('mutationsList', mutationsList);
  console.log('observer', observer);
  // Use traditional 'for loops' for IE 11
  for (let mutation of mutationsList) {
    if (mutation.type === 'childList') {
      console.log('A child node has been added or removed.');
    } else if (mutation.type === 'attributes') {
      console.log('The ' + mutation.attributeName + ' attribute was modified.');
    }
  }
};

// Create an observer instance linked to the callback function
// const observer = new MutationObserver(callback);

// Start observing the target node for configured mutations
// observer.observe(targetNode, config);
