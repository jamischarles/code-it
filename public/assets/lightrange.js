// LightRange.js - A simple and lightweight selection, range and caret information library in native JavaScript, with an additional selection save & restore system. - https://github.com/n457/LightRange.js
// Version 2.2.0
// MIT License - Copyright (c) 2015 Bertrand Vignaud-Lerouge / n457 - https://github.com/n457
var LightRange = function() {};
LightRange.prototype.getSelectionInfo = function() {
  var a = {};
  if (window.getSelection) {
    var b = window.getSelection(),
      e = document.body.scrollTop,
      f = document.body.scrollLeft;
    if (0 < b.rangeCount) {
      var d = b.getRangeAt(0).cloneRange(),
        c = d.getBoundingClientRect();
      0 === c.height && (c = d.getClientRects()[0]);
      c &&
        ((a.width = c.width),
        (a.height = c.height),
        (a.xStart = c.left + f),
        (a.yStart = c.top + e));
      a.text = b.toString();
      a.charStart = d.startOffset;
      a.charEnd = d.endOffset;
      d.collapse(!1);
      if ((c = d.getClientRects()[0]))
        (a.xEnd = c.left + f), (a.yEnd = c.top + e);
    }
  } else if (document.selection)
    (b = document.selection.createRange()),
      (e = document.documentElement.scrollTop),
      (f = document.documentElement.scrollLeft),
      (a.width = b.boundingWidth),
      (a.height = b.boundingHeight),
      (a.xStart = b.boundingLeft + f),
      (a.yStart = b.boundingTop + e),
      (a.text = b.text),
      b.collapse(!1),
      (a.xEnd = b.boundingLeft + f),
      (a.yEnd = b.boundingTop + e);
  else return null;
  a.text
    ? ((a.characters = a.text.replace(/\s/g, '').length),
      (a.charactersAll = a.text.replace(/[\n\r]/g, '').length))
    : ((a.characters = 0), (a.charactersAll = 0));
  return a;
};
LightRange.prototype.saveSelection = function() {
  if (window.getSelection) {
    var a = window.getSelection();
    if (a.getRangeAt && a.rangeCount) return a.getRangeAt(0);
  } else
    return document.selection && document.selection.createRange
      ? document.selection.createRange()
      : null;
};
LightRange.prototype.restoreSelection = function(a) {
  if (a) {
    if (window.getSelection) {
      var b = window.getSelection();
      b.removeAllRanges();
      b.addRange(a);
    } else if (document.selection && a.select) a.select();
    else return null;
    return a;
  }
};
var lightrange = new LightRange();
