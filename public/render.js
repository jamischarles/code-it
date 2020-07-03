// responsible for generating HMTL, rendering UI etc...
import Prism from 'prismjs';

import {
  restoreCaretPos,
  getRangeFromPosition,
  getActiveRowEl,
} from './prism_exp';
import {PEER_ID} from './firebase';
import {getCharById, getState} from './state';
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

  return tokenized;
}

export function renderToDom(node, html) {
  // debugger;
  node.innerHTML = html;
}

//FIXME: replace this with a dom ref in state or similar...
function getRowByIndex(i) {
  var rows = document.querySelector('.rows');

  return rows.children[i];
}

// render caret from state
// get the char node and attach to that...?
// that would be the simplest way to do it...?
// maybe for now we'll use char position...
//

// this is called after chars are modified in some way
// arrrow keys currently aren't being used for this...
export function renderOwnCaret(caretObj) {
  if (!caretObj) return;
  // find the char we need to insert caret after
  // console.log('caretObj', caretObj);

  // if we have no char as reference point, use caretObj.line as fallback and go to line=caretObj.line and charPos=0
  if (!caretObj.afterChar) {
    var row = getRowByIndex(caretObj.line);
    return restoreCaretPos(row, 0);
  }

  var pos = caretObj.afterChar.pos;
  var row = getRowByIndex(pos.line);
  restoreCaretPos(row, pos.charPosition + 1);
}

// we'll need to debounce this...
// periodically poll state, or wherever we store this
// THEN see if it's changed...
// If it has, then update the caret pos...
// We'll also want to show/hide based on who is online...
export function renderPeerCarets(peerState) {
  console.log('renderPeer: peerState', peerState);
  //a7

  // get online peers (should be cached locally) in state...
  // get their
  // state.peers.online.c5.caret
  // console.log('RENDER PEER CARETS');
  var state = getState();
  var caretsToRender = state.peers.map(peer => peer.caret);

  var fragment = document.createDocumentFragment();

  state.peers.forEach((peer, i) => {
    var caretObj = peer.caret;

    var char = getCharById(caretObj);

    if (!char) return;

    // don't render peer caret for myself. Only carets for other peers
    if (PEER_ID === peer.peerId) return;

    var caretEl = createPeerCaretHTML(peer.peerId, char.pos, i);

    fragment.appendChild(caretEl);
  });

  console.log('RENDER peer carets: caretsHTML', fragment);
  document.getElementById('carets').innerHTML = ''; // wipe out all the children
  document.getElementById('carets').appendChild(fragment);

  // render all the html that was returned

  // var char = {pos: {line: 0, charPosition: '4'}};
  // console.log('##char', char);

  // if (char) {
  // }
}

function createPeerCaretHTML(peerName, caretPos, count) {
  var rowEl = getRowByIndex(caretPos.line);
  var range = getRangeFromPosition(rowEl, caretPos.charPosition + 1); // +1 because we need to render the caret AFTER the charId position...
  // console.log('caretPos.charPosition', caretPos.charPosition);
  // get x,y position of caret where peer caretIs
  // console.log('## range', range);
  var peerRect = range.getBoundingClientRect();

  //TODO: make getRangeFromCharPos()
  // var range = document.createRange();
  // range.setStart(sel.anchorNode, sel.anchorOffset); // HACK: needs a -1 if at the very end? WHY? isn't long enough? Maybe end is the problem? Set start before? or after?
  // range.setEndAfter(rowEl, 0);
  //

  // we can simulate this virtually by adding nodes to a range...  (or a single char?)
  // FIXME: THIS is the way to go...
  // WOW THIS WORKED AMAZING.
  // TODO: SAVE THIS TECHNIQUE and write it down for making a virtual, custom styled caret that follows around the real caret...
  //
  //
  // SAVE: technique for adding vCaret on top of real caret
  // 1. On selection change, call this
  // 2. get range obj from current selection (will return exact caret pos
  // 3. use range.getBoundingClientRect() to get abs position of caret
  // 4. use .top and .left of that to abs position a 1px by 18px stylized caret on top of the real caret
  // 5. MAGIC
  // This same technique will work to render peer carets and peer selections...
  var rect = window
    .getSelection()
    .getRangeAt(0)
    .getBoundingClientRect();

  // console.log('############peerRect', peerRect);

  var caret = document.createElement('span');
  caret.className = 'peer-caret';
  caret.id = 'peer-caret-' + count;

  caret.style.top = peerRect.top;
  caret.style.left = peerRect.left;

  return caret;

  // Q: Can we get the v caret to follow the caret with this technique?

  // Q: Could we create a range exactly where it neeeds to be (in vdom if needed)
  // - Then get range.getBoundingClientRect() or range.getClientRects()

  // range = document.createRange();
  // range.selectNode(document.getElementsByTagName("div").item(0));
  // rectList = range.getClientRects();

  // Q: How do we measure the distance exactly?
  // We could make a clone and measure that?
  // insert a real span and measure the exact distance to that point...?
}

// util FNs
//

function generateHtmlFromState() {}
