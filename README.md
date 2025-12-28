# VidGo

VidGo 是一个面向 NAS 用户与小型团队的 **本地视频管理平台**，核心目标是：

- **采集**：从 Bilibili / YouTube / Apple Podcasts 等来源下载媒体
- **处理**：字幕转录、翻译、编辑、导出硬字幕
- **管理**：分类/合集/权限
- **播放**：Web 播放器与字幕面板
- **桌面端**：Electron 客户端（可集成启动本地后端）

在线示例：<https://example.vidgo.cemp.top/>

项目文档：<https://doc.vidgo.cemp.top/>

---

## 目录

- [核心功能](#核心功能)
- [整体架构](#整体架构)
- [技术栈与依赖](#技术栈与依赖)
- [目录结构](#目录结构)
- [数据与文件存储](#数据与文件存储)
- [配置说明](#配置说明)
- [开发环境启动](#开发环境启动)
- [Docker 部署](#docker-部署)
- [Electron 桌面端](#electron-桌面端)
- [关键 API 概览](#关键-api-概览)
- [常见问题与排错](#常见问题与排错)

---

## 核心功能

### 1) 流媒体下载

- 支持平台：Bilibili / YouTube / Apple Podcasts
- 支持任务队列与进度（分阶段：`video/audio/merge`）
- 下载成功后可自动入库（生成 `Video` 记录并落盘至 `media/`）

### 2) 智能字幕系统

- 多引擎转录（本地/云端）
- 字幕优化（智能断句、分割）
- 翻译与双语字幕
- 字幕编辑器（波形同步/实时预览）
- 导出硬字幕视频

### 3) 视频管理

- 分类 / 合集
- 批量操作
- 缩略图与媒体文件管理

### 4) 用户与权限

- 主用户 / 普通用户
- 分类可见性控制

### 5) 播放体验

- Web 播放器
- 字幕面板（双语切换/滚动/章节跳转）

界面预览：

![概览](https://doc.vidgo.cemp.top/assets/images/overview-6abee6dae72e659c5837d798dd0090a2.png)

---

## 整体架构

项目为 **前后端分离**，并提供 Electron 桌面封装。

### 架构分层

- **Frontend（Web / Electron Renderer）**
  - Vue3 页面与组件
  - 通过 HTTP 调用后端 API
  - 播放器/字幕编辑/任务列表等 UI

- **Electron Main（可选）**
  - 负责创建窗口
  - 负责 **启动/守护** 本地 Python 后端（开发模式运行 `manage.py runserver`，生产模式运行打包后的可执行文件）
  - 通过 `/api/health/` 做健康检查

- **Backend（Django API）**
  - 提供 REST 风格 API
  - 内置任务队列（字幕/下载/导出/TTS）
  - SQLite 存储视频元信息
  - 文件落盘至 `backend/media/`

### 任务系统（重要）

后端任务由 `video/apps.py` 在 Django 启动时拉起调度线程，采用 `ThreadPoolExecutor` 实现并发：

- 字幕任务：并发数较小（避免 optimise_srt 内部再开线程导致线程爆炸）
- 下载任务：I/O 密集，默认最多 12 并发
- 导出任务：CPU 密集，默认等于 CPU 核心数
- TTS 任务：CPU 密集，默认等于 CPU 核心数

> 生产环境建议使用 `backend/run_all.sh`（gunicorn 单进程 + 多线程）以避免多进程下内存态共享（例如下载任务状态）不一致。

---

## 技术栈与依赖

### 后端（Python / Django）

- Python：建议 `3.10+`
- Django：`django`
- CORS：`django-cors-headers`
- 下载：`yt-dlp`
- 图像：`Pillow`
- 视频处理：`ffmpeg-python`（底层仍依赖系统 `ffmpeg`）
- 其他：`opencv-python-headless`、`openai`、`gunicorn`、`librosa`、`soundfile`

依赖文件：`backend/requirements.txt`

### 前端（Vue3 / Vite / Electron）

- Vue：`vue@3`
- 构建：`vite` / `vue-tsc`
- UI：`element-plus`
- 路由与状态：`vue-router` / `pinia`
- 播放与波形：`video.js` / `wavesurfer.js`
- 文档/图：`mermaid` / `markmap-view` / `highlight.js`
- Electron：`electron` + `vite-plugin-electron`

依赖文件：`frontend/package.json`

### 系统级依赖（必须安装）

- **ffmpeg**：用于音视频合并、转码、硬字幕导出等
-（可选）GPU / CUDA：如果使用本地 ASR 模型并需要加速

---

## 目录结构

```text
vidgo/
  backend/                 # Django 后端
    vid_go/                # Django project 配置（urls/settings/wsgi）
    video/                 # 核心业务 app：视频/字幕/下载/导出等
    accounts/              # 用户认证与权限
    utils/                 # 下载器、转写、转换、LLM 等工具
    database/              # SQLite DB（videos.db）
    media/                 # 媒体落盘目录（saved_video/saved_audio/thumbnail/...）
    work_dir/              # 临时工作目录（下载中间文件、导出临时文件等）
    run_all.sh             # 生产启动脚本（gunicorn 单进程多线程）
    backend.spec           # PyInstaller 打包 spec
  frontend/                # Vue3 + Vite + Electron
    src/                   # UI 源码
    electron/              # Electron main/preload + python-manager
    dist-electron/         # Electron 构建产物
    vite.config.ts         # Vite 配置（含 electron 插件）
  docker-compose.yml       # Docker 部署示例（推荐）
  docker-compose-cpu-only.yml
  .env.example             # 环境变量示例（后端）
  README.md
```

---

## 数据与文件存储

### 数据库

- 默认使用 SQLite：`backend/database/videos.db`
- 由 `backend/vid_go/settings.py` 中 `DATABASES` 配置指定

### 媒体文件（默认 MEDIA_ROOT）

`MEDIA_ROOT`：`backend/media/`

常见子目录：

- `media/saved_video/`：入库后的视频文件（通常以 md5 命名）
- `media/saved_audio/`：播客等音频文件
- `media/thumbnail/`：缩略图
-（可能存在）`media/saved_srt/`：字幕文件

### 下载/入库流程（简述）

以流媒体下载为例：

1. 下载视频/音频到 `backend/work_dir/...`
2. `ffmpeg` 合并
3. 计算合并产物 MD5 作为文件名
4. 移动到 `MEDIA_ROOT/saved_video` 或 `MEDIA_ROOT/saved_audio`
5. 创建 `Video` 记录（自动入库）

---

## 配置说明

项目的主要配置分为后端和前端两部分。

### 后端配置

后端配置由两部分组成：根目录的 `.env` 文件和 `backend/config/config.ini` 文件。

#### 1. 环境变量 (`.env`)

在项目根目录创建一个 `.env` 文件（可从 `.env.example` 复制），用于设置高级别的环境变量。

- `VIDGO_URL`：你的 VidGo 实例的公开访问 URL。这个变量会自动配置后端的 `CORS_ALLOWED_ORIGINS`、`CSRF_TRUSTED_ORIGINS` 和 `ALLOWED_HOSTS`，是生产部署时的关键。

#### 2. INI 配置文件 (`backend/config/config.ini`)

这个文件包含了大部分的应用层功能配置，如 API 密钥、字幕样式、转录引擎设置等。请根据 `config.ini.example` 创建你自己的 `config.ini`。

**`[DEFAULT]` - LLM 通用配置**
- `selected_model_provider`：默认使用的 LLM 提供商（如 `deepseek`, `openai`, `glm`, `qwen`, `modelscope`）。
- `enable_thinking`：是否启用 LLM 的“思考”模式（通常用于调试）。
- `*_api_key`：各个 LLM 提供商的 API Key。
- `*_base_url`：各个 LLM 提供商的 API 服务地址。
- `use_proxy`：是否为 LLM 请求使用代理。

**`[Video watch]` - 视频观看设置**
- `raw_language`：视频的默认源语言（例如 `zh` 代表中文）。

**`[Subtitle settings]` & `[Foreign Subtitle settings]` - 字幕样式**
这两个区域分别定义了主字幕和外语字幕的默认样式，包括字体、颜色、大小、背景、边框等。

**`[Media Credentials]` - 媒体凭证**
- `bilibili_sessdata`：用于下载 Bilibili 会员视频的 `SESSDATA` Cookie 值。

**`[Transcription Engine]` - 字幕转录引擎**
- `primary_engine`：首选的转录引擎（如 `whisper_cpp`, `elevenlabs`, `alibaba`, `openai`）。
- `fwsr_model`：当使用 `whisper_cpp` 时，指定的模型大小（如 `large-v3`）。
- `use_gpu`：是否为本地 `whisper_cpp` 启用 GPU 加速。
- `*_api_key` / `*_model`：各个云端转录服务的 API Key 和模型名称。

**`[Remote VidGo Service]` - 远程 VidGo 服务**
用于将字幕转录任务代理到另一台高性能的 VidGo 实例上。
- `host`, `port`, `use_ssl`：远程实例的地址、端口和是否使用 SSL。

**`[OSS Service]` - 对象存储服务**
可选的对象存储配置，用于媒体文件。
- `oss_access_key_id`, `oss_access_key_secret`, `oss_endpoint`, `oss_bucket`, `oss_region`：阿里云 OSS 相关配置。

**`[TTS settings]` - 文本转语音**
- `dashscope_api_key`：阿里 DashScope 的 API Key，用于 TTS 服务。

### 前端配置

前端配置位于 `frontend/.env` 文件中，主要用于开发环境。

- `VITE_BACKEND_ORIGIN`：指定 Vite 开发服务器连接的后端 API 端口。例如 `VITE_BACKEND_ORIGIN=8000`。请注意，这需要与你本地启动后端时使用的端口匹配。

---

## 开发环境启动

### 1) 前端（Web / Electron Dev Server）

```bash
# 在 frontend 目录
npm install
npm run dev
```

默认端口：`http://localhost:4173/`（见 `frontend/vite.config.ts`）

### 2) 后端（Django 开发服务器）

```bash
# 在 backend 目录
pip install -r requirements.txt
python manage.py runserver 127.0.0.1:18000
```

后端健康检查：`GET http://127.0.0.1:18000/api/health/`

### 3) 后端（生产方式启动：gunicorn）

```bash
# 在 backend 目录
pip install -r requirements.txt

# Linux/macOS
bash run_all.sh

# Windows：建议直接使用 manage.py runserver 进行开发；
# 生产部署建议用 Docker 或 WSL/Linux。
```

`run_all.sh` 默认端口为 `8000`（可通过 `PORT` 环境变量覆盖）。

---

## Docker 部署

### docker-compose（推荐）

```bash
docker compose up -d
```

默认会映射端口到宿主机（见 `docker-compose.yml`）。

### 环境变量

根目录提供 `.env.example`，核心变量：

- `VIDGO_URL`：用于自动配置 `CORS_ALLOWED_ORIGINS / CSRF_TRUSTED_ORIGINS / ALLOWED_HOSTS`

---

## Electron 桌面端

### 开发模式

```bash
# 在 frontend 目录
npm install
npm run electron:dev
```

开发模式下 Electron 会：

- 启动 Vite dev server（默认 `4173`）
- 通过 `frontend/electron/python-manager.ts` 启动后端：
  - `python manage.py runserver 127.0.0.1:18000 --noreload`
  - 并通过 `GET /api/health/` 检测后端是否就绪

### 生产打包

1. 打包后端（PyInstaller）：

```bash
# 在 backend 目录
pip install pyinstaller
pyinstaller backend.spec

# 将 dist/vidgo-backend 打包产物复制到仓库根的 backend-dist
mkdir ../backend-dist
cp -r dist/vidgo-backend/* ../backend-dist/
```

2. 打包 Electron：

```bash
# 在 frontend 目录
npm run build:electron
```

Electron 打包配置：`frontend/electron-builder.yml`（会把 `backend-dist` 作为额外资源打进安装包）。

---

## 关键 API 概览

健康检查：

- `GET /api/health/`

CSRF：

- `GET /api/get_csrf_token/`

流媒体：

- `POST /api/stream_media/query`
- `POST /api/stream_media/download/add`
- `GET /api/stream_media/download_status`

媒体文件：

- `GET /media/<type>/<filename>`
- `GET /media/thumbnail/?url=...`（缩略图代理，白名单域名）

---

## 常见问题与排错

### 1) 前端路由懒加载报错 / 动态导入失败

症状：`Failed to resolve import "hls.js" / "mermaid" / "markmap-view"` 或 `Failed to fetch dynamically imported module ...`

处理：

```bash
# 在 frontend 目录
npm install
```

如果缺少依赖：

```bash
npm install hls.js mermaid markmap-view
```

### 2) Electron 后端端口为什么是 18000

Electron 的后端地址在 `frontend/electron/python-manager.ts` 中写死为：

- `http://127.0.0.1:18000`

并在开发模式下以 `manage.py runserver 127.0.0.1:18000 --noreload` 启动。

### 3) CORS/CSRF 相关问题

后端在 `backend/vid_go/settings.py` 支持通过 `VIDGO_URL` 自动注入：

- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `ALLOWED_HOSTS`

可参考根目录 `.env.example`。

---

## Roadmap

- [ ] 模糊搜索
- [ ] 字幕编辑器 UI 继续优化
- [ ] AI 笔记 / 思维导图 / 章节生成
- [ ] 更多 ASR 模型与更多 LLM 适配

