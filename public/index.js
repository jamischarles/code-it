import Prism from 'prismjs';
import {saveCaretPos, restoreCaretPos} from './prism_exp';

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

var editor = document.getElementById('editor');

// TODO next: just debounce this when you've stopped typing...
// Q: keyup vs keydown?
// keydown seems faster... less delay NICE.
// and TAB only works on keydown
editor.addEventListener('keydown', function(e) {
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
    e.metaKey
  )
    return;

  // TODO Make this switch statement
  var TABKEY = 9;
  if (key === TABKEY) handleTab(e);

  var pos = saveCaretPos(document.getElementById('editor'));
  Prism.highlightElement(editor, false, function() {
    console.log('done', arguments);
    console.log('pos', pos);
    restoreCaretPos(document.getElementById('editor'), pos);
  });
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

  range.insertNode(textNode);

  // Move caret to the end of the newly inserted text node
  range.setStart(textNode, textNode.length);
  range.setEnd(textNode, textNode.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

// TODO: if backspace on double space, just wipe out both?

function handleEnter(e) {}

// TODO: handle opposite shift
// e.shiftKey=true
