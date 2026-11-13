# v1.0.0 · 鲸鲸图片补丁（来张美图 / 看看脚）

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.0**。

## 这个版本做了什么

- 在微信聊天里识别图片指令：`来张美图`、`看看脚`、`来张动漫少女`、`看看猫`…
- 从公开安全图库搜索图片并发回当前聊天：
  - Openverse（CC 授权）
  - Wikimedia Commons（自由版权）
  - Safebooru（仅 `rating:safe`，排除泳装/内衣/裸露/未成年标签）
- 启动器新增 **「图片」** 栏；旧「补丁」栏仍在（如果装了旧补丁）。
- 管理页可以逐个勾选群聊/私聊、编辑类别、试预览。
- 安装时可选桌面快捷方式；默认安装目录与基础软件一致。

## 基础软件下载与安装（必读）

1. 打开鲸鲸 Release 下载页：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 下载 Windows 安装包，安装到例如 `D:\WhaleGirl`，记住目录；
3. 打开启动器：配置模型、登录微信、确认桥接在线；
4. 再安装本补丁。

> 补丁不自带模型、微信自动化或 API Key。

## 安装 / 更新（3 步）

1. 下载 `whale-girl-image-patch-v1.0.0.zip`，解压；
2. 双击 `install.cmd`：
   - 自动找鲸鲸目录；找不到会让你选包含 `server.js` 的文件夹；
   - 自动备份 `server.js`、启用表情包发送通道、替换启动器（可选）；
   - 最后询问是否创建桌面快捷方式；
3. **完全退出启动器**（托盘右键退出）再打开 → 点「启动」→ 左侧 **「图片」**。

## 没有快捷方式怎么更新

1. 打开 <https://github.com/7ather-LX/whale-girl-image-patch/releases/latest>；
2. 下载最新 ZIP；
3. 解压到固定目录；
4. 双击 `install.cmd`；
5. 完全退出启动器再打开。

## 使用

在管理页勾选聊天后：

```text
@鲸鲸 来张美图
@鲸鲸 看看脚
@鲸鲸 来张风景
@鲸鲸 来张动漫少女
```

- 「美图」默认走风景；「脚」是安全的鞋袜/足部类别，不是色情内容。
- 默认 15 秒冷却、每小时 30 张，可改。
- 管理页：<http://127.0.0.1:8787/image-patch/> 或启动器「图片」。

## 安全与版权

- 只请求公开 HTTPS 图库，拒绝本机/内网地址，图片上限 8 MB。
- 拒绝色情、未成年、偷拍、裸露等词。
- Safebooru 只请求 `rating:safe` 并排除泳装/内衣/裸露标签；图片版权归原作者，
  **仅限个人聊天使用，不要商用或二次分发**。
- Openverse / Wikimedia 保留作者和许可证；回复会带来源。
- 图片由第三方图库提供，不保证每张都符合预期；可以改搜索词或停用类别。

## 已知限制

- 需要基础软件开启 `features.stickers`（安装器会自动开启并备份 `config.json`）；
  如果手动关掉表情包功能，图片发不出去。
- 只适配鲸鲸 **4.1.0**；基础软件更新后重跑 `install.cmd`。
- 没有网络/图库被墙时，会回一句“没找到合适的图”，不会发假图。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- **AGPL-3.0-only**；分发请保留 `LICENSE`、`NOTICE.md` 和完整源码。

> 完全免费、为爱发电，没有收费版、没有广告。
