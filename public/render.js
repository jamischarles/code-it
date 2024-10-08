// responsible for generating HMTL, rendering UI etc...
// vDom stuff will be here as well
// and we'll keep track and provide utils that involve the dom...
import Prism from 'prismjs';

import {
  restoreCaretPos,
  getRangeFromPosition,
  getRangeFromStartAndEndPosition,
  getActiveRowEl,
} from './prism_exp';
import {getSelfPeerId} from './firebase';
import {
  getCharById,
  getLiveCharFromDeadOne,
  getState,
  restoreOwnSelection,
} from './state';
//
//
//

// this will allow us to do the following:
// - keep track of position by charID in the dom (where each char has been inserted)
// - vDom stuff. Old vs new row content so we can see where and how to inserts content
var renderCacheByRows = [[]]; // start with single row

// key: id
var posCacheById = {};

function getRowLengthFromRenderCache(rowNum) {
  return renderCacheByRows[rowNum].length;
}

export function getPositionFromCharId(charId) {
  // implementation details... Subject to change later...
  //
  // For now let's use the liveContent in state
  return posCacheById[charId] && posCacheById[charId].pos;
}

// return the char rendered to this pos during the last render cycle (cached)
// if you don't want it to charPos:--1, pass exactPosition == true (needed when getting ranges of chars)
// FIXME: maybe we should move the --1 to another spot... It is nice having it in 1 place though...
// FIXME: If the 2nd param for ranges causes confusion, just make it a separate fn that just returns it...
export function getCharAtPosition(pos, exactPosition) {
  var {line, charPosition} = pos;

  if (exactPosition) return renderCacheByRows[line][charPosition];

  // if 0,0 then don't decrement and return early
  if (line === 0 && charPosition === 0) {
    return renderCacheByRows[line][charPosition];
  }

  // FIXME: charPosition-1 should be applied universally... Should we fix this here or in saveCaret()? / getPos() logic?
  charPosition--;

  // if charPosition = -1, it means we need the last item on the prior row...
  if (charPosition === -1) {
    line--;
    charPosition = renderCacheByRows[line].length - 1;
  }

  return renderCacheByRows[line][charPosition];
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
  // console.log('##state', state);

  posCacheById = {}; // reset position cache
  renderCacheByRows = [[]]; // reset renderCache
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

    // console.log(`#99 SELECTION POS: ${lineCounter}:${posCounter}`);
    // console.log('#99 SELECTION val', val);
    // console.log('#99 SELECTION char.id', char.id);
    // console.log('#99 SELECION posCounter', posCounter);

    // override char position object with what matches what will be rendered.
    // FIXME: This is needed because the prior value is inaccurate. Is this happening in updateState()?
    // Q: Should we remove char positions from there? It probably won't be accurate...
    char.pos = {line: lineCounter, charPosition: posCounter};
    renderCacheByRows[lineCounter].push(char); // save the current item to the renderCache for easy position lookups after

    // save off current char to posCache so we can easily retrieve position later
    posCacheById[char.id] = content[i];
    posCacheById[char.id].pos = {line: lineCounter, charPosition: posCounter};

    // handle tab chars...
    if (val === '\v') {
      // val = '&#9;';
      // val = '__TAB__';
      // TODO: write a prism plugin that replaces custom char input with custom char output...
      // U+0009
    }

    // if we encounter a new line, flush the buffer to array
    if (val === '\n') {
      if (currentRowStr === '') {
        // if row is empty, then add <br> tag so the line can hold a caret in the UI
        currentRowStr = '<br>';
        rows.push(currentRowStr); // don't tokenize <br> empty line
      } else {
        rows.push(tokenize(currentRowStr));
      }

      currentRowStr = '';
      lineCounter++;
      posCounter = 0; // reset pos counter
      renderCacheByRows.push([]); // add another row entry to renderCache. FIXME: can we simplify some of these data structures?
      continue;
    }

    // these last two are never run because of continue statement
    // so the \n is never added to dom... what if it was in dom?
    // do we like <br> or \n better in dom?
    // at end we have divergence between renderCache[[hello],[]] and rows...[[hello]]
    // maybe we should
    // also renderCache includes the \n char whereas rows doesn't
    // What if it did?
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

  // if the very last char rendered was a newline, we need to make sure to add a <br> on the next row for it in the dom...
  // weird hackiness. This is one point of deviation I don't like from renderCache to rows (actual html):
  // \n will be stored in cache as {val="\n"} at the end of the row, but in the html it'll show up as <br> at the beginning ONLY if it's an empty line.
  if (val === '\n') {
    rows.push('<br>');
  }

  if (currentRowStr.length > 0) {
    // if there's text left in the buffer (like on last row) make sure we add that
    rows.push(tokenize(currentRowStr));
  }

  // if no rows, and no content, add a <br> so we can focus the caret in the editor
  if (rows.length === 0) {
    rows.push('<br>');
  }

  // console.log('##rows to RENDER', rows);
  return rows;
}

// turn raw html into code
function tokenize(str) {
  // tokenize the current row content...
  var tokenized = Prism.highlight(
    str,
    Prism.languages.javascript,
    'javascript',
  );

  // replace my custom chars with the proper html values I want...
  // debugger;
  // return tokenized.replace(/__TAB__/g, "<span class='tab'></span>");
  // return tokenized.replace(/__TAB__/g, '&#9;');
  // return tokenized.replace(/\v/g, '&#9;'); // replace tab char with html tab entity
  return tokenized.replace(/\v/g, "<span class='tab'>&nbsp;</span>");
}

// FIXME: add some vDom diffing either here, or in renderToDom
// Do that after we have multi rows working...
export function renderToDom(node, htmlRows, cb) {
  // console.log('##renderToDom: node', node);
  // console.log('##renderToDom: html', htmlRows);
  var html = '';
  htmlRows.forEach(rowContent => {
    html += `<div class="row">${rowContent}</div>`;
  });
  node.innerHTML = html;

  // hacky way to get a "rendered" callback...
  // Could make this a promise... That polls and resolves when it it's in the dom...
  setTimeout(cb, 0);
}

//FIXME: replace this with a dom ref in state or similar...
export function getRowByIndex(i) {
  var rows = document.querySelector('.rows');

  return rows.children[i];
}

export function renderOwnCaretOrSelection() {
  var state = getState();
  // console.log('state.selection', state.selection);

  // if theres a selection  render that, else render caret
  if (state.selection && state.selection.start) {
    // console.log('RENDER OWN SELECTION');
    renderOwnSelection();
  } else {
    // console.log('RENDER OWN CARET');
    renderOwnCaret();
  }
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
  // if (caretObj.afterChar) {
  //   pos = getPositionFromCharId(caretObj.afterChar.id);
  // } else {
  //   // if there's no afterChar, assume we are at very beginning of editor
  //   pos = {line: 0, charPosition: 0};
  // }

  // if we have no char as reference point, use caretObj.line as fallback and go to line=caretObj.line and charPos=0
  if (!caretObj.afterChar) {
    var rowEl = getRowByIndex(0);
    return restoreCaretPos(rowEl, 0);
  }

  // FIXME: does this invalidate the logic we're using earlier...?
  var pos = caretObj.afterChar.pos;
  var rowEl = getRowByIndex(pos.line);
  var charPos = pos.charPosition + 1;

  // FIXME: is this even used?
  // if we need to render caret after a \n newline char, jump pos to next line.
  if (caretObj.afterChar && caretObj.afterChar.value === '\n') {
    rowEl = getRowByIndex(pos.line + 1);
    // console.log('##rowEl', rowEl);
    var r = document.querySelector('.rows');
    // console.log('##.rows', r);
    charPos = 0;
  }

  restoreCaretPos(rowEl, charPos);
}

// FIXME: just having this here to have a consistent API surface... it's not really helping
export function renderOwnSelection() {
  var state = getState();
  if (!state.selection) return;

  var {start, end} = state.selection;

  // console.log('start', start);
  // console.log('end', end);
  // FIXME: try the naive approach first (use stored position on the char)
  var range = getRangeFromStartAndEndPosition(start, end);

  var selObj = window.getSelection();
  selObj.addRange(range);

  // must clear before adding a new range (since most browsers only allow 1 range selected at a time)
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(range);
}

// we'll need to debounce this...
// periodically poll state, or wherever we store this
// THEN see if it's changed...
// If it has, then update the caret pos...
// We'll also want to show/hide based on who is online...
export function renderPeerCarets(peerState) {
  // console.log('renderPeer: peerState', peerState);
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

    // if dead char (no pos) then get the prior living sibling
    if (char.tombstone) {
      char = getLiveCharFromDeadOne(char.id);
    }

    var caretEl = createPeerCaretHTML(peer.peerId, char.pos, i);

    fragment.appendChild(caretEl);
  });

  // console.log('RENDER peer carets: caretsHTML', fragment);
  document.getElementById('carets').innerHTML = ''; // wipe out all the children
  document.getElementById('carets').appendChild(fragment);

  // render all the html that was returned

  // var char = {pos: {line: 0, charPosition: '4'}};
  // console.log('##char', char);

  // if (char) {
  // }
}

// array of peers
export function renderPeerSelections(peerState = []) {
  var peerSelectionsToRender = [];

  peerState.forEach(peer => {
    if (peer.selStart && peer.selEnd) {
      peerSelectionsToRender.push({
        peerId: peer.peerId,
        start: peer.selStart,
        end: peer.selEnd,
      });
    }
  });

  var fragment = document.createDocumentFragment();
  peerSelectionsToRender.forEach(selection => {
    // don't render selection caret for myself. Only selections for other peers
    //
    // comment this out for easy debugging
    if (getSelfPeerId() === selection.peerId) return;
    // only render self selection
    // if (getSelfPeerId() != selection.peerId) return;

    var startChar = selection.start;
    var endChar = selection.end;

    var startPos = getPositionFromCharId(startChar);
    var endPos = getPositionFromCharId(endChar);

    // console.log('#-1 SELECTION: renderCacheByRows', renderCacheByRows);
    // console.log('#-1 SELECTION: posCacheById', posCacheById);
    // console.log('#-1 SELECTION: selection', selection);
    // console.log('#-1 SELECTION: startChar', startChar);
    // console.log('#-1 SELECTION: startPos', startPos);
    // console.log('#-1 SELECTION: endChar', endChar);
    // console.log('#-1 SELECTION: endPos', endPos);

    // shift right by one char so it's in the right place...
    // startPos.charPosition++;
    // endPos.charPosition++;

    // FIXME: We want to create a range for each row that the selection is a part of...
    // Then we draw a selection div for each of those...
    // So...
    // 1) For each row that's in the selection, get:
    // - x, startPos
    // - number of chars on line (or xy for end of line)
    // 2) Render the range for that row
    // 3) Do the same for each row

    // make 1 selection range for each row that's selected
    var selectionRangesByRow = [];
    var startRow = startPos.line;
    var endRow = endPos.line;

    // debugger;

    // FIXME: simplify this whole function!
    for (var i = startRow; i <= endRow; i++) {
      // start/end for current row
      let rowStartPos = {
        line: i,
        charPosition: 0,
      };

      // if on first row, use the startPosition instead of beginning of line
      if (startRow === i) rowStartPos.charPosition = startPos.charPosition;

      let rowEndPos = {
        line: i,
        charPosition: getRowLengthFromRenderCache(i) - 1, // basically the index of the last char in the row
        // can I just calc it smartly...
      };

      // if on last row, use the endPosition instead of end of line
      if (endRow === i) rowEndPos.charPosition = endPos.charPosition;

      // console.log('#0 SELECTION: startPos', rowStartPos);
      // console.log('#0 SELECTION: rowEndPos', rowEndPos);

      let selectionRange = getRangeFromStartAndEndPosition(
        rowStartPos,
        rowEndPos,
      );
      selectionRangesByRow.push(selectionRange);
    }

    // console.log('SELECTION: selectionRangesByRow', selectionRangesByRow);
    // console.log('SELECTION: selectionRange', selectionRange);

    selectionRangesByRow.forEach(range => {
      var peerId = range.peerId;
      var selEl = createPeerSelectionHTML(peerId, range, 0);
      fragment.appendChild(selEl);
    });
    //
  });

  document.getElementById('peer-selections').innerHTML = ''; // wipe out all the children
  document.getElementById('peer-selections').appendChild(fragment);

  // measure pixel place
  // get start pos, width for each row of selection needed
  //
  //
  // get ending pos and which row (y pos...)

  // var canvas = document.getElementById('p-selections');
  // var ctx = canvas.getContext('2d');
  //
  // ctx.fillStyle = 'rgb(200, 0, 0)';
  // ctx.fillRect(10, 10, 50, 50);
  // if (canvas.getContext) {
  //   var ctx = canvas.getContext('2d');
  //   // drawing code here
  // } else {
  //   // canvas-unsupported code here
  // }
}

// FIXME: use this...
function createPeerSelectionHTML(peerName, range, count) {
  // var rowEl = getRowByIndex(caretPos.line);
  // var range = getRangeFromPosition(rowEl, caretPos.charPosition + 1); // +1 because we need to render the caret AFTER the charId position...
  // console.log('caretPos.charPosition', caretPos.charPosition);
  // get x,y position of caret where peer caretIs
  // console.log('## range', range);
  var peerRect = range.getBoundingClientRect();

  // console.log('SELECTION:: peerRect', peerRect);

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
  // var rect = window
  //   .getSelection()
  //   .getRangeAt(0)
  //   .getBoundingClientRect();

  // console.log('############peerRect', peerRect);

  var sel = document.createElement('span');
  sel.className = 'peer-selection';
  sel.id = 'peer-selection-' + count;

  // https://javascript.info/coordinates AMAZING
  // Take scrollPos (with pageYOffset) into account so it's perfectly aligned the first time with abs pos, regardless of where the scrollPosition is
  sel.style.top = peerRect.top + window.pageYOffset;
  sel.style.left = peerRect.left + window.pageXOffset;
  sel.style.width = peerRect.width;

  return sel;

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
  // var rect = window
  //   .getSelection()
  //   .getRangeAt(0)
  //   .getBoundingClientRect();

  // console.log('############peerRect', peerRect);

  var caret = document.createElement('span');
  caret.className = 'peer-caret';
  caret.id = 'peer-caret-' + count;

  // https://javascript.info/coordinates AMAZING
  // Take scrollPos (with pageYOffset) into account so it's perfectly aligned the first time with abs pos, regardless of where the scrollPosition is
  caret.style.top = peerRect.top + window.pageYOffset;
  caret.style.left = peerRect.left + window.pageXOffset;

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
