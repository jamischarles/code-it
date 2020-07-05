// responsible for generating HMTL, rendering UI etc...
// vDom stuff will be here as well
// and we'll keep track and provide utils that involve the dom...
import Prism from 'prismjs';

import {
  restoreCaretPos,
  getRangeFromPosition,
  getActiveRowEl,
} from './prism_exp';
import {getSelfPeerId} from './firebase';
import {getCharById, getState} from './state';
//
//
//

// this will allow us to do the following:
// - keep track of position by charID in the dom (where each char has been inserted)
// - vDom stuff. Old vs new row content so we can see where and how to inserts content
var renderCache = [];

var posCacheById = {};

export function getPositionFromCharId(charId) {
  // implementation details... Subject to change later...
  //
  // For now let's use the liveContent in state
  return posCacheById[charId] && posCacheById[charId].pos;
}

// str data structure?
// html data structure? Do we even need to save the html? Might be nice...
// As of now we'll be calling prism A LOT... we'll have to see if that causes any perf issues...
// TODO: try to apply partial updates at some point. For now just update everything...
// TODO: maybe we'll just debounce prism...

// FIXME: Should render() mean "write to string" or "apply to DOM"?
export function renderHTMLFromState(state) {}

// request a row (returns str) or no row, returns array of strings
// maybe just always do 1?
// FIXME: add some vDom diffing either here, or in renderToDom
// FIXME: consider adding dirty checks for tokenizing so we don't have to do that unecessarily...
// FIXME: later we can check for perf bottlenecks...
// TODO: Do a write up for how to do that easily and quickly and publish it...
// returns  ['row1Content', 'row2Coentent'] etc
// FIXME: can we simplify this... esp the row and line counting logic?
export function writeHtmlStrFromState(state, row) {
  console.log('##state', state);

  posCacheById = {}; // reset position cache
  var rows = [];

  // get ALL the content
  var content = state.liveContent;

  // buffer all the content for the current row
  var currentRowStr = '';
  var lineCounter = 0; // which row are we on?
  var posCounter = 0; //on current row

  for (var i = 0; i < content.length; i++) {
    var char = content[i];
    var val = char.value;

    // save off current char to posCache so we can easily retrieve position later
    posCacheById[char.id] = content[i];
    posCacheById[char.id].pos = {line: lineCounter, charPosition: posCounter};

    // if we encounter a new line, flush the buffer to array
    if (val === '\n') {
      if (currentRowStr === '') {
        // if row is empty, then add <br> tag so the line can hold a caret in the UI
        currentRowStr = '<br>';
      }

      rows.push(tokenize(currentRowStr));
      currentRowStr = '';
      lineCounter++;
      posCounter = 0; // reset pos counter
      continue;
    }

    currentRowStr += val;
    posCounter++;
  }

  // for (var i = 0; i < content.length; i++) {
  //   var row = contentByRows[i];
  //
  //   var str = '';
  //   // loop through chars and build html
  //   row.forEach(item => {
  //     str += item.value; // || '';
  //   });
  //
  //   // if emptry str for the line, just add <br> tag so line can hold a caret.
  //   if (str === '') {
  //     return '<br>';
  //   }
  //
  //   var tokenizedStr = Prism.highlight(
  //     str,
  //     Prism.languages.javascript,
  //     'javascript',
  //   );
  // }

  // if there's text left in the buffer (like on last row) make sure we add that
  if (currentRowStr.length > 0) {
    rows.push(tokenize(currentRowStr));
  }

  // if no rows, and no content, add a <br> so we can focus the caret in the editor
  if (rows.length === 0) {
    rows.push('<br>');
  }

  return rows;
}

// turn raw html into code
function tokenize(str) {
  // tokenize the current row content...
  return Prism.highlight(str, Prism.languages.javascript, 'javascript');
}

// FIXME: add some vDom diffing either here, or in renderToDom
// Do that after we have multi rows working...
export function renderToDom(node, htmlRows) {
  console.log('##renderToDom: node', node);
  console.log('##renderToDom: html', htmlRows);
  var html = '';
  htmlRows.forEach(rowContent => {
    html += `<div class="row">${rowContent}</div>`;
  });
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
export function renderOwnCaret() {
  var pos;

  // FIXME: store this under state.self...? maybe we could store self_ID there and caret and similar...
  var caretObj = getState().caret;
  if (!caretObj) return;
  // find the char we need to insert caret after
  // console.log('caretObj', caretObj);

  // we either need position, or a charID...
  if (caretObj.afterChar) {
    pos = getPositionFromCharId(caretObj.afterChar.id);
  } else {
    // if there's no afterChar, assume we are at very beginning of editor
    pos = {line: 0, charPosition: 0};
  }

  // if we have no char as reference point, use caretObj.line as fallback and go to line=caretObj.line and charPos=0
  if (!caretObj.afterChar) {
    var row = getRowByIndex(pos.line);
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
    if (getSelfPeerId() === peer.peerId) return;

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
