# 鲸鲸图片补丁 · WhaleGirl Image Patch

让鲸鲸在微信里听懂 **「来张美图」「看看脚」「来张动漫少女」** 这类指令，
从正规、安全的公开图库搜索图片，并把图片发回当前聊天。

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.2**。

> **最新版：v1.2.0** · [Release](https://github.com/7ather-LX/whale-girl-image-patch/releases/tag/v1.2.0)

> 视频介绍（B站）：<https://www.bilibili.com/video/BV18QWi62E4r/>
> 聊天互通补丁视频：<https://www.bilibili.com/video/BV1bhWv6GEU2/>

## 功能

- **按指令发图**：`来张美图`、`看看脚`、`来张风景`、`来张动漫少女`、`看看猫`…
- **指定单一角色 + 属性组合**：`看看东海帝皇的脚`、`看看波奇酱的脚`、`来张东海帝皇的黑丝`；
  **不需要提前添加角色**：未配置的名字会用基础软件的模型自动翻译成 Safebooru tag 并缓存，16 个常见角色走内置兜底。
- **每个聊天单独开关**：群聊 / 私聊分别控制，也可以逐个聊天勾选。
- **同一张图不重复**：默认 24 小时内所有聊天共享去重记录，不会两个群收到同一张。
- **类别可编辑**：名称、指令词、图库来源、搜索词都能改；可以新建「猫 / 美食 / 星空 / 腿足」等类别。
- **正规安全图库**：
  - Openverse（CC 授权，保留作者/许可证）
  - Wikimedia Commons（自由版权）
  - Safebooru（仅 `rating:safe`，排除泳装/内衣/裸露/未成年等标签）
  - Bilibili 视频封面（从 B 站搜索结果取封面，版权归原作者）
- **安全边界**：拒绝色情、未成年、偷拍等词；只请求 HTTPS；限制图片大小和下载域名；不读取本机文件。
- **回复带来源**：默认发出图片前回一句「类别 · 来源 · 作者 · 许可证」；管理页可关闭，变成只发图片。
- **本地管理页**：`http://127.0.0.1:8787/image-patch/`；安装器会给启动器加 **「图片」** 栏（多文件构建，非单文件自解压），也可以直接用浏览器打开。

## 基础软件下载与安装（必读）

1. 打开鲸鲸 Release 下载页：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 下载 Windows 安装包，安装到例如 `D:\WhaleGirl`，并记住目录；
3. 打开启动器：配置模型、登录微信、确认桥接在线；
4. 再安装本补丁。

> 补丁不自带模型、微信自动化或 API Key，只给已安装的鲸鲸加功能。

## 安装 / 更新（3 步）

1. 下载本仓库 Release 的 `whale-girl-image-patch-vX.Y.Z.zip`，解压；
2. 双击 `install.cmd`：
   - 自动找鲸鲸目录；找不到会弹窗让你选包含 `server.js` 的文件夹；
   - 会备份 `server.js`、启用基础软件的表情包发送通道、替换启动器（可选）；
   - 最后询问是否创建桌面快捷方式；
3. **完全退出启动器**（托盘右键退出）再打开 → 点「启动」→ 左侧 **「图片」**（也可以打开 `http://127.0.0.1:8787/image-patch/`）。

> 只点启动器里的「重启」不够，新的启动器文件要完全退出再打开才会加载。

### 桌面快捷方式（安装时可选）

安装最后会问：

```text
Create desktop shortcuts (install/update + management page)? [Y/n]
```

- `Y`：创建「鲸鲸图片补丁-安装或更新」和「鲸鲸图片补丁-管理页」；
- `n`：不创建，按下面「没有快捷方式怎么更新」操作。

### 没有快捷方式怎么更新

1. 打开 <https://github.com/7ather-LX/whale-girl-image-patch/releases/latest>；
2. 下载最新 ZIP；
3. 解压到固定目录（例如 `D:\WhaleGirlImagePatch`）；
4. 双击解压目录里的 `install.cmd`；
5. 完全退出启动器再打开。

### 命令行安装（可选）

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -AppRoot "D:\WhaleGirl"
```

- `-SkipLauncher`：只装服务端补丁，不替换启动器；
- `-CreateShortcuts` / `-NoShortcuts`：静默指定是否创建快捷方式。

## 使用

在已勾选的聊天里：

```text
@鲸鲸 来张美图
@鲸鲸 看看脚
@鲸鲸 看看东海帝皇的脚
@鲸鲸 来张东海帝皇的黑丝
@鲸鲸 看看初音未来的校服
@鲸鲸 来张风景
@鲸鲸 来张动漫少女
@鲸鲸 看看猫
```

- 群里建议 @ 鲸鲸；私聊直接说。
- **不用提前添加角色**：`波奇酱`、`芙莉莲` 这种没配置的名字，会自动用模型翻译成 Safebooru tag 并缓存 30 天；
  模型不可用时退回 B 站中文搜索。管理页「角色对象」只用于固定常用角色的别名 / tag。
- 角色后面的「脚 / 腿 / 裤袜 / 黑丝 / 校服 / 和服 / 猫耳…」会组合成图库 tag；
  例：`看看东海帝皇的脚` → `tokai_teio barefoot 1girl solo`。
- 「美图」默认走「风景」；「脚」映射到 **「腿足 / 鞋袜」**（动漫腿足、裤袜、鞋袜类，不是运动鞋，也不是色情内容）。
- 同一聊天默认 15 秒冷却，每小时最多 30 张；同一张图默认 24 小时内所有聊天不重复，可在管理页改。

### 管理页

- 启动器左侧 **「图片」**；
- 或浏览器打开 <http://127.0.0.1:8787/image-patch/>。

可以：

- 总开关；
- 群聊 / 私聊默认开关 + 逐个聊天勾选；
- 新建/删除类别，改名称、指令词、图库、搜索词（图库含 Bilibili 视频封面）；
- 调冷却、每小时上限、同一张图不重复时间；
- 开关「发图前先发一条类型/作者文字」；
- 「试一张」：只搜索预览，不发微信；可以选择角色并输入「脚」等属性。

## 安全与版权

- 只请求公开 HTTPS 图库；拒绝本机/内网地址；限制图片 8 MB。
- 不提供色情、未成年、偷拍、裸露内容；命中词直接拒绝，不搜索。
- Safebooru 只请求 `rating:safe` 并排除泳装/内衣/裸露等标签；图片版权归原作者，
  **仅限个人聊天使用，不要商用、不要二次分发**。
- Openverse / Wikimedia 图片保留作者和许可证信息；需要署名时回复里会带。
- 图片由第三方图库提供，补丁不保证每张都符合你的预期；发现不合适可在管理页换搜索词或停用类别。

## 兼容性

- 适配鲸鲸 **4.1.2**（多文件启动器，带「补丁 / 图片」栏；Defender 扫描通过）。
- 基础软件更新后，重新运行 `install.cmd`。
- 旧版 4.0.8.2 不保证可用；如果只要服务端功能，用 `-SkipLauncher` 并手动打开管理页。

## 安全说明（重要）

之前的**单文件** `WhaleLauncher.exe` 被 Windows Defender 的 ML 规则误报为
`Trojan:Win32/Bearfoos.B!ml`。现在改成**框架依赖的多文件构建**（exe + DLL，不再自解压打包），
并对整个发布目录跑了 `MpCmdRun -Scan`，扫描结果 **no threats**。
如果 Defender 仍然对某个文件报警，请让系统隔离/删除，不要关闭防护或加白名单；
补丁的服务端功能和浏览器管理页不依赖这个启动器。

## 卸载

双击 `uninstall.cmd`，会删除补丁挂钩、补丁目录、恢复启动器和 `config.json` 备份。
`data/whale-image-patch.json` 和已下载图片会保留，方便重装。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)），<https://github.com/Banan1cee/whale_girl>。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- 遵循 **AGPL-3.0-only**；分发或通过网络提供修改版时，请保留 `LICENSE`、`NOTICE.md` 并提供完整对应源码。

> 本补丁完全免费、为爱发电，没有收费版、没有广告。
