// responsible for generating HMTL, rendering UI etc...
import Prism from 'prismjs';

import {restoreCaretPos} from './prism_exp';
//
//

// str data structure?
// html data structure? Do we even need to save the html? Might be nice...
// As of now we'll be calling prism A LOT... we'll have to see if that causes any perf issues...
// TODO: try to apply partial updates at some point. For now just update everything...
// TODO: maybe we'll just debounce prism...

// FIXME: Should render() mean "write to string" or "apply to DOM"?
export function renderHTMLFromState(state) {}

// request a row (returns str) or no row, returns array of strings
// maybe just always do 1?
export function writeHtmlStrFromState(state, row) {
  var row = state.rows[0];
  console.log('row', row);

  var str = '';
  // loop through chars and build html
  row.forEach(item => {
    // don't render tombstoned items
    if (!item.tombstone) {
      str += item.value || '';
    }
  });

  // if emptry str for the line, just add <br> tag so line can hold a caret.
  if (str === '') {
    return '<br>';
  }

  var tokenized = Prism.highlight(
    str,
    Prism.languages.javascript,
    'javascript',
  );

  console.log('str', str);
  console.log('tokenized', tokenized);
  return tokenized;
}

export function renderToDom(node, html) {
  // debugger;
  node.innerHTML = html;
}

function getRowByIndex(i) {
  var rows = document.querySelector('.rows');

  return rows.children[i];
}

// render caret from state
// get the char node and attach to that...?
// that would be the simplest way to do it...?
// maybe for now we'll use char position...
export function renderCaret(caretObj) {
  if (!caretObj) return;
  // find the char we need to insert caret after
  console.log('caretObj', caretObj);

  // if we have no char as reference point, use caretObj.line as fallback and go to line=caretObj.line and charPos=0
  if (!caretObj.afterChar) {
    var row = getRowByIndex(caretObj.line);
    return restoreCaretPos(row, 0);
  }

  var pos = caretObj.afterChar.pos;
  var row = getRowByIndex(pos.line);
  restoreCaretPos(row, pos.charPosition + 1);
}

// util FNs
//

function generateHtmlFromState() {}
