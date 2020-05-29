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
editor.addEventListener('keyup', function(e) {
  console.log('e key up', e);
  var key = e.keyCode;
  // if arrow keys, don't re-format
  // Also shift selection
  if (key === 37 || key === 38 || key === 39 || key === 40 || key === 16)
    return;
  var pos = saveCaretPos(document.getElementById('editor'));
  Prism.highlightElement(editor, false, function() {
    console.log('done', arguments);
    console.log('pos', pos);
    restoreCaretPos(document.getElementById('editor'), pos);
  });
});
