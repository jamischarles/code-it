import Prism from 'prismjs';

import {getRowByIndex} from './render';

// TODO: we'll want to eventually tototaly control the DOM and not let the editor handle new row additiosn because of rare quirks there...

var editor = document.getElementById('editor');

//
// TODO: Consider instead of this markup swapping magic, we can just use different classes and change the prism styling rules...
// Or find a way to have prism not auto-init itself...
// Becuase Prism auto-inits and wipes out our content, we need to replace it here after the auto-init...
// Prism.hooks.add('complete', function(env) {
//   console.log('Prism: complete hook fired', env);
//   var editor = document.getElementById('editor');
//
//   editor.innerHTML =
//     '<div class="code-rows"></div><div id="line-numbers-container"><span aria-hidden="true" class="line-numbers-rows"></span></div>';
// });
//
// FIXME: where do we mark the row num?
export function updateRowIfNeeded(rowEl) {
  // debugger;
  var tokenized = Prism.highlight(
    rowEl.textContent,
    Prism.languages.javascript,
    'javascript',
  );

  // FIXME: improve this so we only touch innerHTML at the end? FIX this if we have lots of rows we need to tokenize at load...
  // diff the row, and only update html if it's changed...
  // ignore <br> with the diff, so "" is same as "<br>
  if (rowEl.innerHTML.replace('<br>', '') !== tokenized) {
    rowEl.innerHTML = tokenized;
    return true; // updated
  }

  return false; // not updated
}

// you can override the starting point if you pass in the anchorNode
export function getActiveRowEl(forceAnchorNode) {
  // get caret
  var sel = window.getSelection();
  var rowEl;

  // current textNode at cursor (works unless row is blank. Then it can be at a elNode
  var aNode = forceAnchorNode || sel.anchorNode;
  // if you are a textNode
  if (aNode.nodeType === 3) {
    rowEl = aNode.parentNode.closest('.row');
  } else {
    rowEl = aNode.closest('.row');
  }

  return rowEl;
}

// should we update the innerHTML? If yes, update it, and save/restore caret.
// FIXME: turn this into a line by line diff to see what's dirty and what's clean... Similar to vDom dirty checks...
// DELETE
// export function updateEditorWithNewCode(newRawCode) {
//   // current tokenized code
//   var oldCode = editor.innerHTML;
//
//   // tokenize the new code so we can diff it.
//   var newCode = Prism.highlight(
//     newRawCode,
//     Prism.languages.javascript,
//     'javascript',
//   );
//
//   // console.log('oldCode', oldCode);
//   // console.log('newCode', newCode);
//
//   if (oldCode !== newCode) {
//     console.log('Code changed remotely. Update editor');
//     // setEditorCode(editor, newCode);
//     // setEditorCode(editor, prepNewMarkup(newRawCode).join(''));
//   } else {
//     console.log('Code has NOT changed remotely. NO updates.');
//   }
//
//   console.log('prepNewMarkup(newRawCode)', prepNewMarkup(newRawCode));
// }

//
function prepNewMarkup(newContent) {
  var rows = newContent.split('\n');
  // var fragment = new DocumentFragment();

  var arr = rows.map((item, i) => {
    var tokenizedCode = Prism.highlight(
      item,
      Prism.languages.javascript,
      'javascript',
    );
    return `<div class="row" data-row-num=${i + 1}>${tokenizedCode ||
      '&nbsp;'}</div>`;
  });

  return arr;
}

// TODO: Add support for 1 line at a time eventually
export function getEditorCode(editor) {
  return editor.textContent; // ignore all the html. Just the textNodes.
}

// FIXME: should I save and restore caret in here?
// FIXME: should I diff in here?
// TODO:
// Now splits editor into ROW divs. This allows us to have more efficient diffing and keep track of lines better.
function setEditorCode(editor, newContent) {
  // TODO: come up with better diff algo
  // We want to be able to handle partial updates over the wire as well as full updates.
  //
  // first time, add <div> rows
  // subsequent times, add/replace/update <div> rows

  editor.innerHTML = newContent;
  // return editor.textContent; // ignore all the html. Just the textNodes.
}

// FIXME: should we combine this with saveCaretPos or  just refactor it a bit? I don't like having the duped logic...
// returns the charPosition on the current line...
// FIXME: improve this name?
// Use this when you are trying to get start/stop point on a selection or similar
export function getCharPosFromSelectionObj(rowEl, focusedNode, offset) {
  // naive assumption that aNode will always be a textNode. Fix if needed. It is NOT if the line is blank... If there's no text, then it's not a textNode
  // if normal node use closest, if textNode, find normal parent and call closest() as soon as its available.
  // var rowEl =
  //   (aNode.closest && aNode.closest('.row')) ||
  //   aNode.parentNode.closest('.row');
  // var rowNum = Number(rowEl && rowEl.dataset.rowNum); FIXME: We can turn this back on when we store the row num in the dataset
  if (!rowEl) debugger;
  var rowNum = whatChildAmI(rowEl); // FIXME: Q: Does it cost more to walk a attached dom tree vs a cloned domtree? Verify somehow...

  // move to fn?
  // get charPos from parentNode (editor)
  var curNode = focusedNode;
  var charCount = offset;
  // var charCount = 0;
  // var childNumber = 0; // FIXME: off by one?

  // if parentNode is NOT the editor (like we're the textNode inside a span), go up one level... TODO: consider doing this only once with aNode...
  // FIXME: remove this check?
  // if (curNode.parentNode !== editorNode) curNode =  findHighestAncestor(

  // rename node->curNode, offset->charCount
  // debugger;
  // var {node: curNode, offset} = findHighestAncestor(editorNode, aNode, aOffset);

  // run the code, and THEN check if we should loop again...
  // needed because we need to count it even when we reach the first one (and there's no previousSibling)
  // debugger;
  // FIXME: This will ignore the first child...

  // skip the current one because we already got count for it with aOffset...
  // only count chars on the current row we are on...

  // if we're already at div.row (empty row) then bail and return beginning of current row
  if (curNode === rowEl) {
    return {line: rowNum, charPosition: charCount};
  }

  // if we already at first child in current row, then bail
  if (!curNode.previousSibling && curNode.parentNode === rowEl) {
    return {line: rowNum, charPosition: charCount};
  }

  // curNode = curNode.previousSibling || curNode.parentNode.previousSibling;
  curNode = findNearestPrevSibling(curNode, rowEl);

  while (curNode) {
    var length = curNode.length || curNode.textContent.length; // if textnode, it has length, else we can get the textContent of the tag
    charCount += length;
    // ensure we don't visit the rowEl parentNode. It's child is as high as we should go
    // FIXME: simplify this logic...
    // visit the previousSibling. If NO previousSibling, go up a level, but ONLY if that level isn't a <div class="row"> el
    // curNode =
    //   curNode.previousSibling ||
    //   (curNode.parentNode !== rowEl && curNode.parentNode.previousSibling);
    curNode = findNearestPrevSibling(curNode, rowEl);
    // childNumber++;
  }

  return {line: rowNum, charPosition: charCount};
}

// goes up the tree until a previousSibling is found OR until the root node is found...
// get prior sibling. Go UP levels if you have to (until the rootnode)
// FIXME: add unit tests around this...?
function findNearestPrevSibling(startNode, rootNode) {
  // don't go higher than the rootNode
  var curNode = startNode;
  var prevSibling = startNode.previousSibling;

  // if there's no prevSibling, and we aren't at the root, keep going up the tree until we find a previous sibling
  while (!prevSibling && curNode.parentNode !== rootNode) {
    curNode = curNode.parentNode;
    prevSibling = curNode.previousSibling;

    // if we found the node, return and bail
    if (prevSibling) return prevSibling;
  }

  // if we can't go farther return undef
  return prevSibling;
}

// FIXME: Add some unit  test around this...
// Use this when there's an active caret and we only care about storing that pos and not about the selection
// FIXME: maybe we can remove this one and just use the other one...
export function saveCaretPos(rowEl) {
  // debugger;
  // try #1: test position along with other data
  if (!rowEl) throw new Error('PLEASE PASS A rowEl PARAM!!!');

  var pos = window.getSelection(); // get cursor position
  var aNode = pos.anchorNode;
  var aOffset = pos.anchorOffset;

  // return {charPosition: charCount, line: rowNum};
  return getCharPosFromSelectionObj(rowEl, aNode, aOffset);

  // TODO: We only really use charPosition here, so we should  consider just removing the others... It's the only reliable number right now.
  // return {node: aNode, offset: offset, charPosition: charCount, childNumber};
  // return {charPosition: charCount, line: rowNum};
}

// Q: Does offset have to be at the lowest level? Or can it be at a higher level? IS that why codejar traverses the nodes?
// WE have several ways
// we'll use the current row as the starting point now...
// So we don't even need the rowNum for the time being...
export function restoreCaretPos(rowEl, charPosition) {
  if (!rowEl) throw new Error('PLEASE PASS A rowEl PARAM!!!');

  // var node = posObject.node;
  // var anchorOffset = posObject.offset;

  // Approach #1: Find node based on char position that was saved earlier...
  var result = findNodeFromCharPos(rowEl, charPosition);

  // fallback. if no node is found, use the rowEl node. happens in rare cases like when you have 1 char, and you delete it.
  var node = (result && result.node) || rowEl;
  var offset = (result && result.offset) || 0;

  // if (!node) node = rowEl;

  var range = document.createRange();
  var sel = window.getSelection();

  // APPROACH #1
  // range.setStart(editorNode.childNodes[posObject.childNumber], 0); // Works decently (using childnumber)
  // APPROACH #2
  // debugger;
  // FIXME: must handle offset when findNodeFromChar retunrs middle of a node
  //

  // LEARNING: You have to get the textNODE and set the selector on that!
  // fetch the textNode child if it exists, else assume we are textnode and use that.
  range.setStart(/*node.childNodes[0] ||*/ node, offset); // works pretty well too. Maybe even better on brackets...
  // APPROACH #3

  // range.setStart(node, 0);
  // range.setStart(el.childNodes[3], 10);
  range.collapse(true); // bring range down to a single point
  sel.removeAllRanges(); // must remove ranges before adding a new one because browsers can only have 1 selection range
  sel.addRange(range);

  // todo try the setandextend...?
}

// return a range obj from pos obj
export function getRangeFromPosition(rowEl, charPosition) {
  if (!rowEl) throw new Error('PLEASE PASS A rowEl PARAM!!!');

  // debugger;
  var result = findNodeFromCharPos(rowEl, charPosition);

  // fallback. if no node is found, use the rowEl node. happens in rare cases like when you have 1 char, and you delete it.
  var node = (result && result.node) || rowEl;
  var offset = (result && result.offset) || 0;

  var range = document.createRange();
  range.setStart(node, offset); // works pretty well too. Maybe even better on brackets...
  range.collapse(true);

  return range;
}

// FIXME: combine this with prior one and just handle both use cases?
export function getRangeFromStartAndEndPosition(startPos, endPos) {
  if (!startPos) throw new Error('Please pass a startPos obj');
  if (!endPos) throw new Error('Please pass a endPos obj');

  // shift right by one char so it's in the right place...
  // startPos.charPosition++;
  // endPos.charPosition++;

  // FIXME: these numbers are VERY FLAXY
  // console.log('#1 SELECTION: startPos', startPos);
  // console.log('#1 SELECTION: endPos', endPos);

  var start = findNodeFromCharPos(
    getRowByIndex(startPos.line),
    startPos.charPosition,
  );
  var end = findNodeFromCharPos(
    getRowByIndex(endPos.line),
    endPos.charPosition,
  );

  // you can select the newLine char at the end of the line... deleting that removes a newline
  // Q: How do you add a char that the caret ignores but selection doesn't?
  // basically we need to allow selection of the \n char at the end of the line...
  // Browser already does this natively... How can we emulate that with peerselection?

  if (!start) debugger;
  if (!end) debugger;

  // fallback. if no node is found, use the rowEl node. happens in rare cases like when you have 1 char, and you delete it.
  var selStartNode = (start && start.node) || getRowByIndex(startPos.line);
  var selStartOffset = (start && start.offset) || 0;

  var selEndNode = (end && end.node) || getRowByIndex(endPos.line);
  var selEndOffset = (end && end.offset) || 0;

  var range = document.createRange();
  range.setStart(selStartNode, selStartOffset); // works pretty well too. Maybe even better on brackets...
  range.setEnd(selEndNode, selEndOffset);
  // range.collapse(true);

  return range;
}

// todo: return offset as well...
// now also handles weird nested cases like this:
// <span class="token parameter">test<span class="token punctuation">,</span></span>
// WILL return the correct textNode to use...
function findNodeFromCharPos(parentNode, pos) {
  if (!parentNode) throw new Error('PLEASE PASS AN parentNode PARAM!!!');
  var runningCounter = 0;

  // Learning: only textNodes or .textContent gives you length... (maybe inputs too, but we aren't using  those here)
  // iterate through all the childnodes
  var nodes = parentNode.childNodes;

  for (var i = 0; i < nodes.length; i++) {
    var curNode = nodes[i];

    // we have found the node we are looking for... >= so it'll match at the very end of line...
    if (runningCounter + curNode.textContent.length >= pos) {
      // if a textNode, we are good and return
      if (curNode.nodeType === Node.TEXT_NODE) {
        // give us the node and the position the cursor needs to be on the node
        // Since we're at the textnode we don't need to subtract the running counter anymore...
        // debugger;
        return {node: curNode, offset: pos - runningCounter};
      }

      // if NOT a textnode, we need to search the children recursively
      return findNodeFromCharPos(curNode, pos - runningCounter);
    }

    runningCounter += curNode.textContent.length;
  }
}

// pass in node, tells you what child # it is.
// assume only nodes, and not text nodes...
// assumes we are already at the right depth level
function whatChildAmI(node) {
  // debugger;
  var curNode = node;
  var count = 0;

  while (curNode.previousSibling) {
    count++;
    curNode = curNode.previousSibling;
  }

  return count;
}
