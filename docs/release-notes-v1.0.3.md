# v1.0.3 · 适配鲸鲸 4.1.2

> 本补丁适配 **鲸鲸 4.1.2**，安装后请完全退出启动器再打开。

## 这次修复

- 启动器重新编译到 **4.1.2**，左侧「补丁 / 图片」两栏正常出现；
- 安装器按 4.1.2 校验启动器版本，不再因为版本号不匹配跳过页面；
- 自动识别 `F:\deep seek girl\WhaleGirl` 这类带空格 / 中文的自定义安装目录；
- 图片补丁功能不变：来张美图 / 看看脚 / B站图片、24 小时去重、文字提示可关。

## 安装 / 更新

1. 先装鲸鲸 **4.1.2**：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 下载本 Release 的 ZIP，解压，双击 `install.cmd`；
3. 完全退出启动器（托盘右键退出），重新打开；
4. 点「启动」→ 左侧「图片」。

## 安全说明

之前的**单文件** `WhaleLauncher.exe` 被 Windows Defender 的 ML 规则误报为
`Trojan:Win32/Bearfoos.B!ml`。现在改为**多文件构建**（exe + DLL，不再自解压），
并对发布目录跑了 Defender 扫描，结果 **no threats**。
如果系统仍报警，请让 Defender 隔离/删除，不要关闭防护或加白名单；
补丁服务端和浏览器管理页不依赖启动器。

## 使用

```text
@鲸鲸 来张美图
@鲸鲸 看看脚
@鲸鲸 看看B站
```

管理页：<http://127.0.0.1:8787/image-patch/>

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-image-patch>。
- **AGPL-3.0-only**。

> 完全免费、为爱发电。
