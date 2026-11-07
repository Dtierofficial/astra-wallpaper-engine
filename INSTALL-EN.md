# Install Wallpaper Engine for Astra

1. Open Astra → Workshop / Plugins and install **Wallpaper Engine for Astra** from the catalogue. Existing users can update the same plugin.
2. For development or offline testing only, import **`wallpaper-engine-1.1.2-noarch.astraplugin`** from a file instead.
3. Review the local-package warning and grant `push_to_ui` if you want native-window pause notifications.
4. Enable/restart the plugin and reopen its page using **Open**.
5. Select a video, image or experimental Web wallpaper and click **Apply in Astra**.

One package includes English and Russian. The header's language selector defaults to Astra's language, regardless of Windows/browser locale (English fallback). Before the handshake only English loading text is shown. An explicit manual choice is remembered; choose Automatic to follow Astra again. Windows x64, Astra 0.2.7+.

Starting with 1.1.2, **Node.js is included**. No separate Node/npm installation, development tools, administrator rights for Node installation or PATH changes are needed. The native visibility helper uses .NET Framework 4.8. The `noarch` archive name is required by Astra's JavaScript release workflow and does not mean this Windows build supports Linux or ARM.

Scene/PKG playback is not supported. Web projects run local author JavaScript inside an isolated sandbox; only trust content you have reviewed. External network requests, native WE plugins and file dialogs are not supported.

Original WE settings are read, not overwritten. Favorites/preferences survive plugin updates in `%LOCALAPPDATA%\AstraWallpaperEngine`.

The read-only Windows helper detects whether `astraui.exe` has a visible non-minimized window. Hidden/minimized UI releases the wallpaper; restoring UI recreates it. This is not a guarantee that Astra as a whole uses zero GPU.
