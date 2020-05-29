console.log('LOADED');

// FIXME: Add some unit  test around this...
export function saveCaretPos(editorNode) {
  // try #1: test position along with other data
  if (!editorNode) throw new Error('PLEASE PASS AN EDITORNODE PARAM!!!');

  //
  // TODO: Count spaces?
  // debugger;
  var pos = window.getSelection(); // get cursor position
  var aNode = pos.anchorNode;
  var aOffset = pos.anchorOffset;

  // move to fn?
  // get charPos from parentNode (editor)
  var curNode = aNode;
  var charCount = aOffset;
  // var charCount = 0;
  var childNumber = 0; // FIXME: off by one?

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
  curNode = curNode.previousSibling || curNode.parentNode.previousSibling;
  while (curNode) {
    var length = curNode.length || curNode.textContent.length; // if textnode, it has length, else we can get the textContent of the tag
    charCount += length;
    curNode = curNode.previousSibling || curNode.parentNode.previousSibling;
    childNumber++;
  }

  // TODO: We only really use charPosition here, so we should  consider just removing the others... It's the only reliable number right now.
  // return {node: aNode, offset: offset, charPosition: charCount, childNumber};
  return {charPosition: charCount};
}

// Q: Does offset have to be at the lowest level? Or can it be at a higher level? IS that why codejar traverses the nodes?
// WE have several ways
export function restoreCaretPos(editorNode, posObject) {
  // var node = posObject.node;
  // var anchorOffset = posObject.offset;

  // if editor empty or at beginning go back to very beginning

  // Approach #1: Find node based on char position that was saved earlier...
  var {node, offset} = findNodeFromCharPos(editorNode, posObject.charPosition);

  var range = document.createRange();
  var sel = window.getSelection();

  // Q: TODO: Maybe simply
  // codejar way
  // sel.setBaseAndExtent;
  // return;
  // old way

  // range.setStart(editorNode.childNodes[3], 0);

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
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  // todo try the setandextend...?
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
