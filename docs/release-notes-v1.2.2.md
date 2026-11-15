# v1.2.2 · 修复发错角色与 WebP 文件

> 适配 **鲸鲸 4.1.2**。更新后请完全退出启动器（托盘右键退出）再打开。

## 修复

- **角色发错**：
  - 模型翻译出的 Safebooru 角色 tag 会先做标签校验；
  - tag 不存在时不再用 B 站中文搜索乱兜底，避免把别的角色封面当成目标；
  - 没有可验证 tag 时会回一句“没找到这个角色的安全图库”，而不是发错图。
- **图片变成文件 / WebP**：
  - B 站封面改用原图 `.jpg`，不再使用 `@672w...webp`；
  - 避免微信把 WebP 当成文件而不是图片。
- 指定角色的请求不再走 B 站封面兜底，只从 Safebooru 该角色 tag 里找图；
  冷门角色 + 足部没有图时，宁可回“没找到”，也不发错角色。

## 例子

```text
看看东海帝皇的脚
```

- 角色 tag：`tokai_teio`（存在）
- 查询：`tokai_teio barefoot 1girl solo`
- 找不到足部图时，只在该角色 tag 内回退普通图；不会跳到 B 站随机封面。

## 说明

`目白阿尔丹` 这类角色在 Safebooru 没有对应 tag，因此现在会明确提示没找到，
不会再拿 B 站封面冒充。可以在管理页「角色对象」里手动填一个确认存在的 tag。

## 安装

1. 先装鲸鲸 **4.1.2**；
2. 下载 ZIP 解压，双击 `install.cmd`；
3. 完全退出启动器再打开；
4. 私聊 / 群聊直接发指令。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- **AGPL-3.0-only**。

> 完全免费、为爱发电。
