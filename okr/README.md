# OKR — iPhone PWA

个人 OKR（目标与关键成果）管理工具。纯前端实现，无后端、无构建、无登录，数据全部存在 iPhone 本地（localStorage），可以完全离线使用。

**特点**

- 单文件应用，代码 ~700 行
- 添加主屏幕后与原生 App 体验一致：全屏、离线、图标
- 深色模式跟随系统
- JSON 一键备份/恢复，防数据丢失

---

## 一、本地跑一下看看（Windows 11）

```powershell
cd C:\Users\78779\Desktop\ccc\okr
python -m http.server 8000
```

浏览器打开 <http://127.0.0.1:8000> 就能用。

> 本地调试时 Service Worker 也能注册（127.0.0.1 属于 localhost，被 Chrome/Safari 视为安全源）。但**添加到 iPhone 主屏幕不行**——iPhone 不认 Windows 的 localhost。要装到 iPhone 必须走 HTTPS 托管。

---

## 二、部署到 GitHub Pages（推荐，免费）

### 步骤

1. 在 GitHub 建一个仓库（公开或私有都行），比如叫 `okr-pwa`
2. 把 `okr` 目录里的所有内容推到仓库根目录：

   ```powershell
   cd C:\Users\78779\Desktop\ccc\okr
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/okr-pwa.git
   git push -u origin main
   ```

3. 打开仓库网页 → **Settings** → 左侧 **Pages**
4. **Build and deployment** 下面：
   - Source: `Deploy from a branch`
   - Branch: `main`, Folder: `/ (root)`
   - 点 **Save**
5. 等 1–2 分钟，页面上会显示 URL，形如：

   ```
   https://<你的用户名>.github.io/okr-pwa/
   ```

6. 记下来，下面 iPhone 安装要用。

### 以后改代码

```powershell
git add .
git commit -m "更新"
git push
```

GitHub Pages 会自动重新部署。iPhone 上首次重新联网打开一次 URL，新代码会通过 Service Worker 自动更新到缓存。

---

## 三、装到 iPhone（首次）

**前提**：iPhone 和电脑不必须在同一网络。只要 iPhone 能上网就行。

1. iPhone Safari 打开 `https://<你的用户名>.github.io/okr-pwa/`
2. 页面底部点**分享按钮**（方框 + 上箭头）
3. 向下滑找到 **"添加到主屏幕"**
4. 图标和名称可自定义，点**添加**
5. 主屏幕出现 OKR 图标，点开就是全屏

> 图标右上角会有个小小的地球（🌐），这是 iOS 对 PWA 的固有标记，非 App Store 应用无法去除。不影响使用。

**离线验证**：装完之后开飞行模式 → 点主屏幕图标 → 应能正常打开，全部功能可用。

---

## 四、使用方法

### 第一次打开

- 先建一个**周期**（如 `2026 Q4`）
- 点右下角 **+** 建目标（O）
- 展开目标 → 添加关键结果（KR），设 baseline/target/current
- 拖动进度条或用数字输入更新进展
- 目标进度 = 各 KR 进度的平均值

### 日常操作

- 顶部**周期下拉**：切换/新建/删除周期
- 卡片可展开/折叠；展开显示 KR 编辑区
- 每张卡片的**归档 / 删除**按钮在展开状态下

### 备份

- 顶栏**下载图标** → **下载备份 (JSON)**
- 生成的 `.json` 会存到 iPhone 的"文件"App（建议放 iCloud Drive）
- 恢复：同菜单选**恢复备份** → 选 JSON 文件
- **建议**：每完成一个周期时手动备份一次

### 关于 iOS 的 localStorage 清理

iOS 在系统存储空间紧张时，**可能清理长期不用的网页 App 的 localStorage**（罕见但存在）。所以：

- 建议每月/每季度手动备份一次 JSON
- 备份文件放 Files App（iCloud Drive）里就基本不会丢
- 就算真被清了，从备份恢复只需 10 秒

---

## 五、项目结构

```
okr/
├── index.html              # 单页入口
├── manifest.webmanifest    # PWA 清单
├── sw.js                   # Service Worker（缓存 + 离线）
├── app.js                  # 业务逻辑
├── styles.css              # 样式（含深色模式）
├── icons/
│   ├── icon.svg            # 源图标
│   ├── icon-192.png        # manifest 图标
│   ├── icon-512.png        # manifest 图标 + maskable
│   └── apple-touch-icon.png  # iPhone 主屏幕图标（180×180）
├── scripts/
│   └── gen_icons.py        # 图标生成脚本（Pillow）
└── README.md
```

## 六、重新生成图标

改图标设计后：

```powershell
cd C:\Users\78779\Desktop\ccc\okr
pip install pillow
python scripts\gen_icons.py
```

会覆盖 `icons/` 下的 3 个 PNG。

---

## 七、常见问题

**Q: iPhone 打开 URL 后没有"添加到主屏幕"选项？**
- 必须从 Safari 分享菜单添加。Chrome / Edge / Firefox for iOS 用的是 WebKit 内核，但分享按钮里可能只显示"添加到起始页"或类似选项——本质相同。
- 若完全没有相关选项，检查 Safari 是否开启了"添加到主屏幕"功能（设置 → Safari → 添加到主屏幕，开启）。

**Q: 主屏幕图标打开后是白屏？**
- 大概率是 SW 缓存的旧版本坏了。Safari 打开 URL → 强制刷新（长按刷新按钮）→ 再试。
- 依然不行：清除网站数据（设置 → Safari → 清除历史记录与网站数据）→ 重新添加。

**Q: 想换主题色？**
- 改 `styles.css` 里的 `--accent` / `--accent-2` 变量。
- 改 `manifest.webmanifest` 的 `theme_color`。

**Q: 需要多人协作 / 云端同步？**
- v1 不支持。v2 可考虑：IndexedDB + iCloud Drive 手动同步 / WebDAV 后端。当前数据模型已按模块拆分，可平滑迁移。

**Q: 未来想升级成真 iOS App？**
- 前端逻辑（app.js 里的 state 管理）可以直接搬到 React Native。PWA 的 manifest / SW 部分作废。
- 推荐用 Expo + EAS Build（Windows 上也能通过云构建产出 .ipa），需要 Apple Developer Program（$99/年）。

---

## 八、验收清单（部署前自查）

- [ ] `python -m http.server 8000` 打开，浏览器能完整跑一遍流程
- [ ] Chrome DevTools → Application → Manifest 显示完整 manifest
- [ ] Chrome DevTools → Network 勾 Offline → 刷新页面仍能加载
- [ ] 推送到 GitHub Pages 后，URL 可访问
- [ ] iPhone Safari 打开 URL → 添加到主屏幕 → 图标显示
- [ ] iPhone 断网 → 主屏图标打开 → 应用全屏加载，功能可用
- [ ] 备份 → 下载 → 恢复 → 数据一致
