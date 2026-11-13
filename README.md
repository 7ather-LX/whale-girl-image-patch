# 鲸鲸图片补丁 · WhaleGirl Image Patch

让鲸鲸在微信里听懂 **「来张美图」「看看脚」「来张动漫少女」** 这类指令，
从正规、安全的公开图库搜索图片，并把图片发回当前聊天。

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.0**。

## 功能

- **按指令发图**：`来张美图`、`看看脚`、`来张风景`、`来张动漫少女`、`看看猫`…
- **每个聊天单独开关**：群聊 / 私聊分别控制，也可以逐个聊天勾选。
- **类别可编辑**：名称、指令词、图库来源、搜索词都能改；可以新建「猫 / 美食 / 星空 / 鞋袜」等类别。
- **正规安全图库**：
  - Openverse（CC 授权，保留作者/许可证）
  - Wikimedia Commons（自由版权）
  - Safebooru（仅 `rating:safe`，排除泳装/内衣/裸露/未成年等标签）
- **安全边界**：拒绝色情、未成年、偷拍等词；只请求 HTTPS；限制图片大小和下载域名；不读取本机文件。
- **回复带来源**：发出图片前会回一句「类别 · 来源 · 作者 · 许可证」。
- **本地管理页**：`http://127.0.0.1:8787/image-patch/`；启动器左侧新增 **「图片」** 栏。

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
3. **完全退出启动器**（托盘右键退出）再打开 → 点「启动」→ 左侧 **「图片」**。

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
@鲸鲸 来张风景
@鲸鲸 来张动漫少女
@鲸鲸 看看猫
```

- 群里建议 @ 鲸鲸；私聊直接说。
- 「美图」默认走「风景」；「脚」映射到安全的「鞋袜 / 足部」（鞋、袜、足部服饰，不是色情内容）。
- 同一聊天默认 15 秒冷却，每小时最多 30 张，可在管理页改。

### 管理页

- 启动器左侧 **「图片」**；
- 或浏览器打开 <http://127.0.0.1:8787/image-patch/>。

可以：

- 总开关；
- 群聊 / 私聊默认开关 + 逐个聊天勾选；
- 新建/删除类别，改名称、指令词、图库、搜索词；
- 调冷却和每小时上限；
- 「试一张」：只搜索预览，不发微信。

## 安全与版权

- 只请求公开 HTTPS 图库；拒绝本机/内网地址；限制图片 8 MB。
- 不提供色情、未成年、偷拍、裸露内容；命中词直接拒绝，不搜索。
- Safebooru 只请求 `rating:safe` 并排除泳装/内衣/裸露等标签；图片版权归原作者，
  **仅限个人聊天使用，不要商用、不要二次分发**。
- Openverse / Wikimedia 图片保留作者和许可证信息；需要署名时回复里会带。
- 图片由第三方图库提供，补丁不保证每张都符合你的预期；发现不合适可在管理页换搜索词或停用类别。

## 兼容性

- 适配鲸鲸 **4.1.0**（启动器「图片」页基于上游 4.1.0 编译）。
- 基础软件更新后，重新运行 `install.cmd`。
- 旧版 4.0.8.2 不保证可用；如果只要服务端功能，用 `-SkipLauncher` 并手动打开管理页。

## 卸载

双击 `uninstall.cmd`，会删除补丁挂钩、补丁目录、恢复启动器和 `config.json` 备份。
`data/whale-image-patch.json` 和已下载图片会保留，方便重装。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)），<https://github.com/Banan1cee/whale_girl>。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- 遵循 **AGPL-3.0-only**；分发或通过网络提供修改版时，请保留 `LICENSE`、`NOTICE.md` 并提供完整对应源码。

> 本补丁完全免费、为爱发电，没有收费版、没有广告。
