# v1.0.1 · 去重、腿足分类修正、B站图片源

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.0**。

## 修复

- **同一张图不再重复**：默认 24 小时内所有聊天共享去重记录；两个不同的群/私聊不会收到同一张图。
  - 管理页新增「同一张图不重复（分钟）」，默认 1440，可改。
  - 搜索会随机翻页；如果这段时间的图都发过，会提示换类别或稍后再试，不会硬塞重复图。
- **「看看脚」分类修正**：原来的 Openverse `shoes footwear socks` 会搜到运动鞋；
  现在改为 Safebooru 动漫腿足/裤袜（`1girl legs feet thighhighs`），并排除鞋、运动鞋、靴子、高跟鞋、
  泳装、内衣、裸露、未成年等标签。只保留 `rating:safe`。
- **图片来源更广**：新增 **Bilibili 视频封面** 图库，从 B 站搜索结果取封面；
  管理页图库下拉可选，也会在主图库失败时作为兜底。
- **B站默认类别**：新增「B站图片」类别，说「看看B站」「B站壁纸」即可。
- 图片下载增加 9 秒超时和总时长预算，某个图床卡住时会换下一张，不再一条指令等 90 秒。

## 基础软件下载与安装（必读）

1. 打开鲸鲸 Release 下载页：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 下载 Windows 安装包，安装到例如 `D:\WhaleGirl`，记住目录；
3. 打开启动器：配置模型、登录微信、确认桥接在线；
4. 再安装本补丁。

## 安装 / 更新（3 步）

1. 下载 `whale-girl-image-patch-v1.0.1.zip`，解压；
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

```text
@鲸鲸 来张美图
@鲸鲸 看看脚
@鲸鲸 来张动漫少女
@鲸鲸 看看B站
```

- 「脚」是安全的动漫腿足/裤袜类别，不是运动鞋；仍会过滤色情、裸露、未成年内容。
- 默认 15 秒冷却、每小时 30 张、同一张图 24 小时不重复，可改。
- 管理页：<http://127.0.0.1:8787/image-patch/> 或启动器「图片」。

## 安全与版权

- 只请求公开 HTTPS 图库，拒绝本机/内网地址，图片上限 8 MB。
- Safebooru 只请求 `rating:safe`，并按标签再过滤泳装/内衣/裸露/未成年/性暗示标签。
- B站封面、Safebooru 图片版权归原作者，**仅限个人聊天使用，不要商用或二次分发**。
- Openverse / Wikimedia 保留作者和许可证；回复会带来源。
- 图片由第三方图库提供，不保证每张都符合预期；可以改搜索词或停用类别。

## 已知限制

- 需要基础软件开启 `features.stickers`（安装器会自动开启并备份 `config.json`）。
- 只适配鲸鲸 **4.1.0**；基础软件更新后重跑 `install.cmd`。
- 没有网络/图库被墙时，会回一句“没找到合适的图”，不会发假图。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- **AGPL-3.0-only**；分发请保留 `LICENSE`、`NOTICE.md` 和完整源码。

> 完全免费、为爱发电，没有收费版、没有广告。
