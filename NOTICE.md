# NOTICE

本仓库是 **鲸鲸 / Whale Girl** 的外挂补丁，不是独立软件。

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)），
  仓库 <https://github.com/Banan1cee/whale_girl>，许可 **AGPL-3.0-only**。
- 本补丁：**7ather-LX**，仓库 <https://github.com/7ather-LX/whale-girl-image-patch>。

补丁通过安装器在 `server.js` 第一行加一句 `require('./whale-image-patch').install();`，
其余全部在运行时包一层，不修改鲸鲸业务源码。卸载会删除挂钩和补丁目录。

图片由第三方公开图库提供（Openverse、Wikimedia Commons、Safebooru）。
Openverse / Wikimedia 图片保留原作者和许可证信息；Safebooru 图片版权归原作者，
仅限个人聊天使用，不得商用或二次分发。本补丁不提供色情、未成年或偷拍内容。

启动器「补丁 / 图片」页是可选组件：基于上游 4.1.0 启动器源码，以
`launcher/launcher.patch` 提供，成品为 `launcher/WhaleLauncher.exe`。
不安装这个可选组件时，启动器完全保持上游原样。

本项目遵循 **AGPL-3.0-only**。分发或通过网络提供修改版时，请保留 `LICENSE`、本文件，
并提供完整对应源码。
