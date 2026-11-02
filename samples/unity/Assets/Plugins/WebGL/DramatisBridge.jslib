// The Unity Web player's line to its page (site/unity/main.ts): each event is
// a kind and a text, handed to window.dramatisUnityEvent if the page set one.
mergeInto(LibraryManager.library, {
  DramatisPost: function (kind, text) {
    var k = UTF8ToString(kind)
    var t = UTF8ToString(text)
    if (typeof window.dramatisUnityEvent === 'function')
      window.dramatisUnityEvent(k, t)
  },
})
