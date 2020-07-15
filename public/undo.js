// any functionality related to undo/redo...
// Undo stack doesn't survive refresh (could save with localhost).
// Undo stack isn't synced across peers...
// Undo stack isn't affected by peer actions
//
//
// LEARNING: I kind of like splitting files by functaionalty
// like sync (FB), undo, (core), rendering, state mutations
//
// Q: Is preserving the actions more important or the exact order?
// Options:
// A) If you have something in the redo stack after undoing, taking a new action wipes out the redo stack
// b) Preserve the redo stack...
// ? Should we keep 2 different stacks? Should we sync these?
//
// A: For now let's try A...
//
// Q: Can you undo peer operations?
// A: No for now. Let's try that first...
//
//

// FIXME: BUGS to fix:

var undoStack = [];
var redoStack = [];
var lastAction;

export function saveToUndoStack(op) {
  // ACTION TO LOG PROPERLY
  // FIXME: consider wiping redo stack here
  console.log('SAVE TO UNDO', op);
  undoStack.push(op);
  purgeOldUndos(30); // save only last 30 ops
  console.log('SAVED: undoStack', undoStack);
}

// returns op to undo
export function getUndoOp() {
  // if you undo after having perfoming a redo, wipe the redo stack... (avoids weird undo/redo states)
  if (lastAction === 'redo') redoStack = [];

  // remove last item from undo stack and add it to redoStack
  var op = undoStack.pop();

  if (!op) return;

  redoStack.push(op);
  lastAction = 'undo';

  // reverse the op and return
  // TODO: consider storing it in undoStack reversed?
  // No, I like this way better because we have to store it un-reversed in redo stack...
  return getReverseOp(op);
}

export function getRedoOp() {
  var op = redoStack.pop();
  if (!op) return;

  // we can handle delete fine, but insert doesn't work well because the char arleady exists
  // so we need to convert insert to resurrect (because we are undoing a deletion)
  // creates new obj {type:'resurrect', resurrectChars: [ids]}
  if (op.type === 'insert') {
    // debugger;
    op = {
      type: 'resurrect',
      resurrectChars: op.insertChars.map(char => {
        return char.id;
      }),
    };
  }

  if (!op.resurrectChars) debugger;
  // FIXME: this is causing issues because the reversal when we retrieve this breaks it...
  // TODO: perform the reversal at a different time...
  undoStack.push(op); // we can add this here because updateState will not add it to the stack
  lastAction = 'redo';

  return op;
}

// returns a reversed op
// basically just toggles tombstoning
// insert -> tombstone
// tombstone -> resurrect
// resurrect -> tombstone
function getReverseOp(op) {
  var newOp = {};
  if (op.type === 'insert') {
    newOp.type = 'delete';
    newOp.deleteChars = op.insertChars.map(char => {
      return char.id;
    });
    // cp
    // //
    // this means we need to undo a resurrection.
  } else if (op.type === 'resurrect') {
    newOp.type = 'delete';
    newOp.deleteChars = op.resurrectChars;
  } else {
    // does this need to be a "resurrect" action? It's not really about creating something new, but reversing an operation on an existing item.
    // if the item can't be found, we'll just ignore it...
    newOp.type = 'resurrect';
    newOp.resurrectChars = op.deleteChars;
  }

  debugger;
  return newOp;
}

export function purgeOldUndos(numberToSave) {
  undoStack = undoStack.slice(-numberToSave); // pull the last 10 and save as new item
}
