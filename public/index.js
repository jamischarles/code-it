import Prism from 'prismjs';
// doesn't work if we don't do this...
// FIXME: add an explicit INIT or something...
import './firebase';
import {
  saveCurrentEditorToState,
  generateSimpleOperationFromKeystroke,
  getState,
  subscribe,
  subscribeToPeers,
  mergeRemoteOperation,
  getOpQueue,
  flushOpQueue,
} from './state';
import {
  renderToDom,
  writeHtmlStrFromState,
  renderOwnCaret,
  renderPeerCarets,
  renderPeerSelections,
} from './render';
import {
  updateRowIfNeeded,
  saveCaretPos,
  restoreCaretPos,
  getEditorCode,
  getActiveRowEl,
} from './prism_exp';
import './listeners'; // intiialize the listeners... FIXME: Make this explicit, or add it on page, or something...

// TODO LATER:
// Should we use RAF to schedule op updates in a throttled manner? Or is there a better/slower way? with just time...
// strongly consider an event pub/sub system or using something like redux where I can transmit and listen to actions as they happen so I can easily see state changing in the app...
// that way you can see what's causing state changes...
// we could just manually log that in a structured way of course but having some structure like that would really help. Esp if we can opt in /out to how chatty it is.

// Learnings:
//
// this unicode char is great for zero-width, but works less well than <br> because there is a right and left to it, so you have to baspace 2x to get to the next line. <br> seems to work well, because it allows for cursor, is selectable, and only needs one backspace to clear the row...
// if (test.textContent === '\u{200B}') console.log('MATCH', test.textContent);
// var zeroWidthSpace = '\u{200B}';
// unicode reading...
// https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/
// https://flaviocopes.com/javascript-unicode/
//

// CARET changed
// document.addEventListener('selectionchange', () => {
//   console.log('SELECTION changed', document.getSelection());
// });

// FIXME: Add this back in after we get line numbers working...
// Use this structure and approach: http://bililite.com/blog/blogfiles/prism/prismeditor.html
// import './prism-line-numbers';
//
//
// for inline blocks, try this...
//http://bililite.com/blog/blogfiles/prism/prismeditor.html
//
// For x-browser bugs in general look at how he solved them after I try myself...
// https://github.com/dwachss/bililiteRange/blob/master/bililiteRange.fancytext.js

// var Normalizer = require('prismjs/plugins/normalize-whitespace/prism-normalize-whitespace');
// // Create a new Normalizer object
// var nw = new Normalizer({
//   'remove-trailing': true,
//   'remove-indent': true,
//   'left-trim': true,
//   'right-trim': true,
//   'break-lines': 80,
//   indent: 2,
//   #<{(|	'remove-initial-line-feed': false,
// 	'tabs-to-spaces': 4,
// 	'spaces-to-tabs': 4|)}>#
// });
//
// // ..or use the default object from Prism
// nw = Prism.plugins.NormalizeWhitespace;
//
//

var editor = document.getElementById('editor');

// tab key must be handled by keyDown, because focus switch happens before keyUp happens)
editor.addEventListener('keydown', function(e) {
  var ENTER = 13;
  var TAB = 9;
  var BACKSPACE = 8;
  var SHIFT = 16;
  var CTRL = 17;
  var ALT = 18;
  var META = 91; // COMMAND
  var key = e.keyCode;

  // FIXME: instead of opt out, maybe we can just opt in to all the keys...?
  // use regex? for [0-9a-z] and all the chars allowed? Basically alpha numeric...
  // or just make sure there's content involved, and if not, don't treat it like content...
  // maybe use .KEY prop?

  // get the position BEFORE the change is made...
  var rowEl = getActiveRowEl();
  if (rowEl) {
    var pos = saveCaretPos(rowEl);
  } else {
    console.log('warning index.js: expected rowEl but couldn\t get it...');
    pos = {line: 0, charPosition: 0}; // hacky override?
  }

  // if (key === TAB) handleTab(e);
  // Let's leave this off until we need it... When we do use <br> tags for linebreaks... consistently
  // TODO: Turn these back on once we have the other stuff working better...
  // if (key === ENTER) handleEnter(e);

  // if (key === BACKSPACE) handleBackspace(e);
  //

  // for arrow keys, don't generate operations for now (eventually we'll want to update caret state). Maybe use the listener...
  // FIXME: replace this with array
  // FIXME: or replace with switch...
  // if

  // simple hacky way to igore all keys that won't result in single char entry
  // ie: CAPSLOCK, SHIFT, ENTER, etc...
  // we do NOT want to generate operations from any of these...

  // if (key === 37 || key === 38 || key === 39 || key === 40) return;

  // FIXME: redundante because of e.key.length check up above...
  // if (key === SHIFT || key === ALT || key === META || key === CTRL) return;

  // IS cmd different keycode on FF vs chrome?!?
  // Redundant
  // if (e.metaKey) return; // does this even help?

  // for all other mutative actions, catch them, and update in state before updating the UI
  // e.preventDefault();
  generateSimpleOperationFromKeystroke(e, pos);
  // renderOwnCaret(getState().carets[0]); // FIXME: DO we need this?
  // var state = getState();
  // console.log('state', state);
  // writeHtmlStrFromState(state);
});

// TODO next: just debounce this when you've stopped typing...
// Q: keyup vs keydown?
// keydown seems faster... less delay NICE.
// and TAB only works on keydown
// if we use keydown, we run the code before the new key is added... Let's use keyup for now...
editor.addEventListener('keyup', function(e) {
  // console.log('e key up', e);
  var key = e.keyCode;
  // if arrow keys, don't re-format
  // Also shift selection
  // also command keys (metaKey)
  //https://css-tricks.com/snippets/javascript/javascript-keycodes/
  if (
    key === 37 ||
    key === 38 ||
    key === 39 ||
    key === 40 ||
    key === 16 ||
    key === 0 || // backspace
    key === 91 || // cmd key
    key === 18 || // alt key
    e.metaKey // does this even help?
  ) {
    return;
  }

  // debugger;
  // FIXME: how will this work if there have been multi-row changes?
  // At some point we have to check if more than one row are dirty...
  // We'll need a dirty check for any / all of the rows...
  // For now let's go with the naive approach and get that working...
  // updateRowIfNeeded(
  //
  // );
  // get current row
  // var rowEl = getActiveRowEl();
  // console.log('rowEl', rowEl);
  // FIXME: this will likely need to be more than 1 row eventually, but for now  let's be naive...
  //
  // var pos = saveCaretPos(rowEl);
  // var wasUpdated = updateRowIfNeeded(rowEl);

  // if row was updated, we'll need to restore the caret position
  // console.log('wasUpdated', wasUpdated);
  // console.log('pos', pos);
  // if (wasUpdated) {
  //   restoreCaretPos(rowEl, pos);
  // }

  // TODO Make this switch statement
  // Prism.highlightElement(editor, false, function() {
  //   console.log('done', arguments);
  //   console.log('pos', pos);
  //   restoreCaretPos(document.getElementById('editor'), pos);
  // });

  // TODO: extract this...
  // Push to FB
  // var currentSessionKey = '01';
  // send only the current row across the wire
  // var payload = prepPayloadToSend(pos.line, rowEl);

  // saveCurrentEditorToState(editor);
  // sendUpdate(payload);
});

// handle cut event...
document.addEventListener('cut', event => {
  debugger;
  var pos;
  var rowEl = getActiveRowEl();
  if (rowEl) {
    pos = saveCaretPos(rowEl);
  } else {
    console.log('warning index.js: expected rowEl but couldn\t get it...');
    pos = {line: 0, charPosition: 0}; // hacky override?
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/Element/cut_event
  const selection = document.getSelection();
  // event.clipboardData.setData('text/plain', selection.toString().toUpperCase());
  // manually save the selection to clipboard because we are preventing the event from bubbling up later, so this is isn't occurring...
  event.clipboardData.setData('text/plain', selection);

  generateSimpleOperationFromKeystroke(event, pos);
});

// handle paste event...
//

document.addEventListener('paste', event => {
  var pos;
  var rowEl = getActiveRowEl();
  if (rowEl) {
    pos = saveCaretPos(rowEl);
  } else {
    console.log('WARNING index.js: expected rowEl but couldn\t get it...');
    pos = {line: 0, charPosition: 0}; // hacky override?
  }

  generateSimpleOperationFromKeystroke(event, pos);
});

// disallow dragging text
document.addEventListener(
  'dragstart',
  function(e) {
    e.preventDefault();
  },
  false,
);

// editor.addEventListener('paste', event => {
//   let paste = (event.clipboardData || window.clipboardData).getData('text');
//   paste = paste.toUpperCase();
//
//   console.log('event', event);
//   console.log('paste', paste);
//
//   // const selection = window.getSelection();
//   // if (!selection.rangeCount) return false;
//   // selection.deleteFromDocument();
//   // selection.getRangeAt(0).insertNode(document.createTextNode(paste));
//   //
//   // event.preventDefault();
// });

// function prepPayloadToSend(line, rowEl) {
//   var content = rowEl.textContent;
//   return {type: 'update', line, content};
// }

// multiplayer functionality. Single player will go in prism_exp.js

// TODO: rename to 'processUpdate'?
// TODO: NOT BEING USED. REMOVE
// function receiveUpdate(obj) {
//   console.log('server updates sent', obj);
//   var rowsContainer = document.querySelector('#editor .rows');
//
//   var rowEl = rowsContainer.childNodes[obj.line];
//
//   // if it's a new row, we need to create new row...
//   if (!rowEl) {
//     // create new row
//     var rowEl = document.createElement('div');
//     rowEl.className = 'row';
//     rowsContainer.appendChild(rowEl);
//   }
//
//   applyRemoteUpdates(rowEl, obj.content);
//
//   // TODO: add some reconciliation logic...
//   // TODO: look at the multiplayer post for Excalidraw...
//   //
// }

// FIXME: can we combine / colocate this with updateRowIfNeeded()
// Q: Why does location & taxonomy cause me so much stress while I'm just working out the bits? Fugly code should be fine at this stage...
// function applyRemoteUpdates(rowEl, newContent) {
//   var tokenized = Prism.highlight(
//     newContent,
//     Prism.languages.javascript,
//     'javascript',
//   );
//
//   // FIXME: improve this so we only touch innerHTML at the end? FIX this if we have lots of rows we need to tokenize at load...
//   // diff the row, and only update html if it's changed...
//   // ignore <br> with the diff, so "" is same as "<br>
//   if (rowEl.innerHTML.replace('<br>', '') !== tokenized) {
//     rowEl.innerHTML = tokenized;
//     console.log('Remote update applied');
//     return true; // updated
//   }
//
//   console.log('Remote update NOT applied');
//   return false; // not updated
// }

// utils. TODO: move this somewhere else?

// listen for special keys...
//https://stackoverflow.com/questions/4604930/changing-the-keypress
// function handleTab(e) {
//   var range;
//   e.preventDefault(); // prevent focus shift.
//
//   // insert 2 spaces before cursor
//   // TODO: extract this into another fn...
//   var sel = window.getSelection();
//   range = sel.getRangeAt(0);
//   range.deleteContents();
//
//   var textNode = document.createTextNode('  ');
//   // FIXME: Bug with this approach: is you can't opt out of it...
//   // it forces indentatino that you cannot escape from...
//   // var tabNode = document.createElement('span');
//   // tabNode.style = 'margin-left: 2em; display: inline-block;'; // space + extra padding for an extra space. Inline-block ensures that new lines will be at same indentation.
//   // tabNode.innerHTML = '  ';
//   // tabNode.innerHTML = '&ensp;';
//
//   // range.insertNode(tabNode);
//   range.insertNode(textNode);
//
//   // debugger;
//   // Move caret to the end of the newly inserted text node
//   // range.setStart(tabNode.childNodes[0], tabNode.textContent.length);
//   // range.setEnd(tabNode.childNodes[0], tabNode.textContent.length);
//
//   // use this if we use a textNode directly
//   range.setStart(textNode, textNode.length);
//   range.setEnd(textNode, textNode.length);
//   sel.removeAllRanges();
//   sel.addRange(range);
// }

// TODO: if backspace on double space, just wipe out both?

// FIXME: turn this into several smaller, reusable functions...
// TODO:  support: if at very beginning/end of line...
// FIXME: this will need to update state instead of what we're seeing here
// we are operating on a virtual dom now that is rendered to the real dom...
// function handleEnter(e) {
//   e.preventDefault();
//
//   var rowEl = getActiveRowEl();
//
//   // create new row
//   var div = document.createElement('div');
//   div.className = 'row';
//
//   // cut out parts of old row that need to go in new row
//   var fragmentForNewLine = cutRowContentAfterCaret();
//   div.innerHTML = fragmentForNewLine.textContent;
//
//   // if row will have no content ensure <br> tag so it can hold the caret.
//   if (fragmentForNewLine.textContent.length == 0) {
//     div.innerHTML = '<br>';
//   }
//
//   // insert the newly created row after current row
//   rowEl.insertAdjacentElement('afterend', div);
//
//   // if rowEl is empty after moving the space down, then add a space back to ensure no rows are totally empty
//   // this occurs when you hit enter on a row and the caret is at char:0 (first spot)
//   // (empty rows can't hold a caret)
//   if (rowEl.textContent.length === 0) {
//     rowEl.innerHTML = '<br>';
//   }
//
//   // move cursor to start of new row
//   moveCursorToLineStart(div);
//
//   function moveCursorToLineStart(div) {
//     var sel = window.getSelection();
//     var range = sel.getRangeAt(0);
//     // console.log('range', range);
//     // range.deleteContents(); // actually delete the html in the range... interesting... Could be useful after cloning it...
//     range.setStart(div.childNodes[0] || div, 0);
//     range.setEnd(div.childNodes[0], 0);
//     sel.removeAllRanges();
//     sel.addRange(range);
//   }

// TODO: move out of parent fn?
// returns a doc fragment of the content of the code row AFTER where the caret is, and removes from row
// (basically what you need if you hit "enter" in the middle or a row
//   function cutRowContentAfterCaret() {
//     var sel = window.getSelection();
//     //  https://developer.mozilla.org/en-US/docs/Web/API/Range/toString
//     var range = document.createRange();
//     range.setStart(sel.anchorNode, sel.anchorOffset); // HACK: needs a -1 if at the very end? WHY? isn't long enough? Maybe end is the problem? Set start before? or after?
//     range.setEndAfter(rowEl, 0);
//
//     // could use clone + delete, OR extract()
//     var docFragment = range.extractContents();
//
//     return docFragment;
//   }
// }

// util fns

// TODO: don't allow user to erase the only backspace remaining... Add it back in if they do...
// when you try to backspace an empty line, remove the line
// OR we can try this https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
function handleBackspace() {
  // am I at POS 1 on any row other than 1
  var sel = window.getSelection();
  var range = sel.getRangeAt(0);
  // console.log('range', range);
  console.log('sel', sel);
  // do I NOT have text selected? (if I do, it's just a delete (default behavior)
  // collapsed
  // IF
}

// TODO: move this somewhere else?
// TODO: extract this into non-anon function
// Firebase setup and listen for FB db updates...

// TODO: handle opposite shift
// e.shiftKey=true
//
//
// TODO: call this at the correct time...
// FIXME: consider using a simple hooks / pub sub system?
// FIXME: do we want to highlight before we fetch the code from firebase? We'll have to see about cost. For now, yes...
function init(rowsContainerEl) {
  renderPeerSelections();

  // highlightEachRow(rows);
  renderToDom(rowsContainerEl, writeHtmlStrFromState(getState()));

  // subscribe to state updates
  // Should this fire the first time?
  subscribe(state => {
    // console.log('***********UPDATE*************', state);
    // do we still need this here? or can we move this to state.js?
    // we should recalc where the cursor should be  after we perform an operation...
    //
    // var rowEl = getActiveRowEl();
    // var pos = saveCaretPos(rowEl);
    // console.log('save:pos before render', pos);
    // Q: How do we calculate the new insertion point? Should state save and tell use what the new pos should be? Yes. State should store the pos.
    // We don't need operations to move caret, but can be a simple replace. pos=5:3. Should it be based on charID as well? I think so...
    // That way we can group it with a char that was just inserted, and it will move along with the chars. YES. That's how we should store caret pos in state...

    // innerHTML is sync, not async, so we don't need a render callback for now...
    // https://stackoverflow.com/questions/42986295/is-innerhtml-asynchronous#:~:text=The%20innerHTML%20property%20actual%20does,to%20accept%20a%20new%20event.
    // after render call renderOwnCaret()
    renderToDom(rowsContainerEl, writeHtmlStrFromState(getState()));

    renderOwnCaret();

    // 3 ways to do a render callback... (how does react do it?)
    // 1) mutation observer
    // 2) Poll for existence in dom
    //document.body.contains(YOUR_ELEMENT_HERE);
    // el.parentNode == null?
    // div.baseURI
    //element.closest('body') === null
    // 3) setTimeout... (hacky, but easy, let's try this...)
    // 4) window.requestAnimationFrame(() => {
    // console.debug(document.querySelector("video").clientWidth);
    // });

    // need to wait until render completes to call this, or we get race condition where we try to render caret
    // renderOwnCaret();

    // console.log('restore:pos after render', pos);
    // restoreCaretPos(rowEl, pos);

    // renderCarets(state.carets);
  });

  // subscribe to peer updates so we can render carets
  subscribeToPeers(() => {
    var peerState = getState().peers;
    console.log(
      'state:subscribe to peer updates. Render next: peerState',
      peerState,
    );
    renderPeerCarets(peerState);
  });
}

// or we can add a mutation observer? is that a good way to listen for initial population?
// No. I'd rather fire some manual events...
// At some point could could consider redux or xstate, but that's overkill right now...
// TODO: DEAD CODE... REMOVE
// function highlightEachRow(rowsContainer) {
//   // console.log('rowsContainer', rowsContainer.children);
//   var rows = rowsContainer.children;
//
//   // turn the html collection into an array
//   Array.from(rows).forEach(rowEl => {
//     var tokenized = Prism.highlight(
//       rowEl.textContent,
//       Prism.languages.javascript,
//       'javascript',
//     );
//
//     // FIXME: improve this so we only touch innerHTML at the end? FIX this if we have lots of rows we need to tokenize at load...
//     // diff the row, and only update html if it's changed...
//     if (rowEl.innerHTML !== tokenized) {
//       rowEl.innerHTML = tokenized;
//     }
//   });
// }

var rowsContainer = document.querySelector('#editor .rows');

init(rowsContainer);
// setTimeout(() => init(rowsContainer), 500);
