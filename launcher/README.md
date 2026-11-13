这个目录是给鲸鲸 4.1.0 启动器加「补丁 + 图片」两栏的成品：

- `WhaleLauncher.exe`：编译好的启动器（基于上游 4.1.0）；
- `launcher.patch`：相对上游 `main` 4.1.0 的改动（两个 WebView2 页面 + 导航项）；
- `version.txt`：对应本体版本，安装器据此决定装不装。

> 上游：<https://github.com/Banan1cee/whale_girl>，`main` 4.1.0，
> commit `8d541f430622054f84b27c7b349f11a7afeb2a8e`。

重新构建：

```powershell
git clone --branch main https://github.com/Banan1cee/whale_girl.git whale_girl
cd whale_girl
git apply "C:\path\to\whale-girl-image-patch\launcher\launcher.patch"
dotnet add launcher/WhaleLauncher.csproj package Microsoft.Web.WebView2 --version 1.0.4314.35
dotnet publish launcher/WhaleLauncher.csproj -c Release -o out `
  -p:PublishSingleFile=true -p:SelfContained=false -p:IncludeNativeLibrariesForSelfExtract=true
```

「图片」页打开 `http://127.0.0.1:<端口>/image-patch/`；「补丁」页仍打开 `/patch/`，
如果没装旧补丁，它只会显示未连接，不影响「图片」页。
