import Prism from 'prismjs';
import {
  updateRowIfNeeded,
  saveCaretPos,
  restoreCaretPos,
  getEditorCode,
} from './prism_exp';
import './listeners'; // intiialize the listeners... FIXME: Make this explicit, or add it on page, or something...

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
  var key = e.keyCode;
  if (key === TAB) handleTab(e);
  if (key === ENTER) handleEnter(e);
  // if (key === BACKSPACE) handleBackspace(e);
});

// TODO next: just debounce this when you've stopped typing...
// Q: keyup vs keydown?
// keydown seems faster... less delay NICE.
// and TAB only works on keydown
// if we use keydown, we run the code before the new key is added... Let's use keyup for now...
editor.addEventListener('keyup', function(e) {
  console.log('e key up', e);
  var key = e.keyCode;
  // if arrow keys, don't re-format
  // Also shift selection
  // also command keys (metaKey)
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

  // TODO Make this switch statement
  var pos = saveCaretPos(document.getElementById('editor'));
  // Prism.highlightElement(editor, false, function() {
  //   console.log('done', arguments);
  //   console.log('pos', pos);
  //   restoreCaretPos(document.getElementById('editor'), pos);
  // });

  // TODO: extract this...
  // Push to FB
  // var currentSessionKey = '01';
  // FIXME: store this in localstorage or in global window?
  var currentSessionKey = window.location.hash.replace('#', '');

  var updates = {};
  updates[`/sessions/${currentSessionKey}/content`] = getEditorCode(editor);

  // TODO: we must debounce these update DB writes somehow... Though websockets makes the network penalty much less looks like...
  firebase
    .database()
    .ref()
    .update(updates);
});

// listen for special keys...
//https://stackoverflow.com/questions/4604930/changing-the-keypress
function handleTab(e) {
  var range;
  e.preventDefault(); // prevent focus shift.

  // insert 2 spaces before cursor
  // TODO: extract this into another fn...
  var sel = window.getSelection();
  range = sel.getRangeAt(0);
  range.deleteContents();

  var textNode = document.createTextNode('  ');
  // FIXME: Bug with this approach: is you can't opt out of it...
  // it forces indentatino that you cannot escape from...
  // var tabNode = document.createElement('span');
  // tabNode.style = 'margin-left: 2em; display: inline-block;'; // space + extra padding for an extra space. Inline-block ensures that new lines will be at same indentation.
  // tabNode.innerHTML = '  ';
  // tabNode.innerHTML = '&ensp;';

  // range.insertNode(tabNode);
  range.insertNode(textNode);

  // debugger;
  // Move caret to the end of the newly inserted text node
  // range.setStart(tabNode.childNodes[0], tabNode.textContent.length);
  // range.setEnd(tabNode.childNodes[0], tabNode.textContent.length);

  // use this if we use a textNode directly
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

// TODO: if backspace on double space, just wipe out both?

// FIXME: turn this into several smaller, reusable functions...
// TODO:  support: if at very beginning/end of line...
function handleEnter(e) {
  console.log('enter:', e);
  e.preventDefault();

  var sel = window.getSelection();
  var range = sel.getRangeAt(0);
  console.log('range', range);
  // range.deleteContents();
  // range.setStart(div.childNodes[0], 0);
  // Q: Do we need to manually find hte last node?
  // range.setEnd(div.childNodes[0], 0);
  console.log('sel', sel);

  // current textNode at cursor (works unless row is blank. Then it can be at a elNode
  var aNode = sel.anchorNode;
  // if you are a textNode
  if (aNode.nodeType === 3) {
    var rowEl = aNode.parentNode.closest('.row');
  } else {
    var rowEl = aNode.closest('.row');
  }

  console.log('rowEl', rowEl);

  // TODO: consider just using a div here that's block...
  // var textNode = document.createTextNode('\n');
  var div = document.createElement('div');
  div.className = 'row';
  // cut and paste content to new row (anything after caret)
  // https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents
  // range.cloneContents (COPY)

  //https://developer.mozilla.org/en-US/docs/Web/API/Range/extractContents
  // range.extractContents (CUT)
  // range.selectNode(rowEl);
  //

  //  https://developer.mozilla.org/en-US/docs/Web/API/Range/toString //
  var range = document.createRange();

  // range.setStartBefore(aNode, sel.anchorOffset); // start at current caret
  // TODO: Test this when it's an el that's already been formatted.
  // TODO: extract this into a separate fn...
  range.setStart(aNode, sel.anchorOffset); // HACK: needs a -1 if at the very end? WHY? isn't long enough? Maybe end is the problem? Set start before? or after?
  // range.setEnd(rowEl, sel.anchorOffset); // HACK: needs a -1 if at the very end? WHY?
  range.setEndAfter(rowEl, 0);
  //
  // range.setStart(aNode, 0);
  // range.setEnd(rowEl.lastChild, 0);
  console.log('range', range);
  // could use clone + delete, OR extract()
  var test = range.extractContents();
  console.log('test', test);
  // div.innerHTML = 'new row';
  div.innerHTML = test.textContent;
  // if no content, add blank space. You must have at least a space, or the caret won't move there...
  if (test.textContent.length == 0) {
    div.innerHTML = ' ';
  }
  // div.appendChild(test);

  // insert new row after current row
  rowEl.insertAdjacentElement('afterend', div);

  // move cursor to start of new row
  var range = sel.getRangeAt(0);
  console.log('range', range);
  // range.deleteContents(); // actually delete the html in the range... interesting... Could be useful after cloning it...
  range.setStart(div.childNodes[0] || div, 0);
  range.setEnd(div.childNodes[0], 0);
  sel.removeAllRanges();
  sel.addRange(range);

  // create a new row
  // decide what should go in it
  // append it

  // var sel = window.getSelection();
}

// TODO: don't allow user to erase the only backspace remaining... Add it back in if they do...
function handleBackspace() {
  // am I at POS 1 on any row other than 1
  var sel = window.getSelection();
  var range = sel.getRangeAt(0);
  console.log('range', range);
  console.log('sel', sel);
  // do I NOT have text selected? (if I do, it's just a delete (default behavior)
  // collapsed
  // IF
}

function addRow() {}

function removeRow() {}

// TODO: handle opposite shift
// e.shiftKey=true
