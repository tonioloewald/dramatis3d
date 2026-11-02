// Events from the player to its page: in a Web build through
// Assets/Plugins/WebGL/DramatisBridge.jslib, elsewhere to the log.

using System.Runtime.InteropServices;
using UnityEngine;

namespace Dramatis
{
    public static class Bridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        static extern void DramatisPost(string kind, string text);
#endif

        public static void Post(string kind, string text)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            DramatisPost(kind, text);
#else
            Debug.Log($"[dramatis] {kind}: {text}");
#endif
        }
    }
}
