# YUNKE YJS CRDT Service

> Node.js + Yjs CRDT microservice for the YUNKE backend, refactored from the AFFiNE service to keep 100% official compatibility. 参考 AFFiNE 架构重构出的 YUNKE 二进制 CRDT 网关，强制所有 Yjs 操作统一接入。

<p align="center">
  <strong>👇 点击语言按钮直接切换 / Click a language to toggle</strong><br/>
  <a href="#chinese-doc" style="display:inline-block;padding:8px 16px;margin:8px;border-radius:6px;background:#f4b400;color:#000;font-weight:600;text-decoration:none;">🇨🇳 中文文档</a>
  <a href="#english-doc" style="display:inline-block;padding:8px 16px;margin:8px;border-radius:6px;background:#1e88e5;color:#fff;font-weight:600;text-decoration:none;">🇺🇸 English Doc</a>
</p>

> 🧭 **YUNKE 重构说明 / Rework Note**：本服务参考 AFFiNE Yjs CRDT Service 重构，继承其稳定的 CRDT 能力，并针对 YUNKE 后端业务场景做了接口与部署层面的定制；保持 upstream 兼容的同时提供专属能力。

<details id="chinese-doc" open>
<summary><strong>🇨🇳 中文 · 点击展开 / 折叠</strong></summary>

![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![License](https://img.shields.io/badge/License-MIT-orange)

## 项目速览
| 项目 | 说明 |
| --- | --- |
| 服务定位 | Node.js (Express) 微服务，参考 AFFiNE 架构重构，专为 YUNKE 后端暴露官方 Yjs Runtime |
| CRDT 引擎 | Yjs 13.6.10 + lib0，100% 与官方格式一致 |
| 默认端口 | `3001` |
| 部署形态 | Node 18+ 直接运行 / Docker / Docker Compose |
| 健康 & 指标 | `/health` 返回 200；`/metrics` 暴露 Prometheus 指标 |

## 关键特性
- **YUNKE 定制 + AFFiNE 传承**：沿用 AFFiNE Yjs Service 的验证过的核心实现，同时补充 YUNKE 后端需要的接入与部署细节。
- **官方兼容**：所有文档、状态向量、更新均由官方 yjs 库生成，避免 Java 端处理二进制格式。
- **二进制安全网关**：任何试图在 Java 中自建 Yjs 二进制的行为都会造成冲突，该服务是唯一入口。
- **批量处理**：支持批量合并/差异计算，降低网络往返次数。
- **可观测性**：内建 Prometheus 指标、结构化日志，方便接入现有监控体系。
- **云原生友好**：提供 Dockerfile、Compose 示例，支持健康检查与自动重启策略。

## 架构约束
> ⚠️ **所有 Yjs 二进制操作必须通过本服务处理！**

✅ 正确做法：
```java
byte[] emptyDoc = yjsServiceClient.createEmptyDoc(docId);
byte[] merged = yjsServiceClient.mergeUpdates(updates);
```

❌ 错误示例：
```java
byte[] emptyDoc = {0x00, 0x00}; // 在 Java 中手工构造会导致格式不兼容
```

## 功能矩阵
| 功能 | 描述 |
| --- | --- |
| Create Empty Doc | 创建标准空文档，确保所有副本具有一致初始状态 |
| Merge Updates | 将多个 update 合并为单个 update，简化客户端同步 |
| Diff by State Vector | 根据客户端状态向量下发差异 update |
| Extract State Vector | 从 update 中提取 state vector 供增量同步使用 |
| Batch Merge | 支持单次请求处理多个文档的合并 |
| Validate Document | 校验 Yjs 文档/更新是否合法 |
| Health & Metrics | 提供健康检查与 Prometheus 指标 |

## 快速开始
1. **安装依赖**
   ```bash
   npm install
   ```
2. **启动服务**
   ```bash
   # 开发模式（热重载）
   npm run dev

   # 生产模式
   npm start
   ```
   默认监听 `http://localhost:3001`。
3. **健康检查**
   ```bash
   curl http://localhost:3001/health
   ```
4. **环境变量**
   | Key | 说明 |
   | --- | --- |
   | `PORT` | 默认 `3001`，可按需覆盖 |
   | `NODE_ENV` | `development` / `production`，影响日志与错误堆栈 |

## API 概览
| # | Endpoint | Verb | 描述 |
| - | --- | --- | --- |
| 1 | `/api/yjs/create-empty` | POST | 创建标准空文档 |
| 2 | `/api/yjs/merge` | POST | 合并多个 Yjs updates |
| 3 | `/api/yjs/diff` | POST | 根据状态向量返回差异 update |
| 4 | `/api/yjs/state-vector` | POST | 提取 state vector |
| 5 | `/api/yjs/batch/merge` | POST | 批量合并多个文档 |
| 6 | `/api/yjs/validate` | POST | 校验文档/更新是否合法 |
| 7 | `/health` | GET | 健康检查 |
| 8 | `/metrics` | GET | Prometheus 指标 |

### 示例：Create Empty
```json
{
  "docId": "optional-doc-id"
}
```
```json
{
  "success": true,
  "empty": "AAEAAcgA",
  "size": 3,
  "hexPreview": "00 01 00",
  "timestamp": "2025-10-23T10:30:00.000Z"
}
```

### 示例：Merge Updates
```json
{
  "updates": [
    "AQIDBAU=",
    "BgcICQo="
  ]
}
```

### 示例：Diff by State Vector
```json
{
  "updates": ["BASE64_UPDATE"],
  "stateVector": "BASE64_STATE_VECTOR"
}
```

### 示例：Batch Merge
```json
{
  "documents": [
    { "docId": "doc-1", "updates": ["..."] },
    { "docId": "doc-2", "updates": ["..."] }
  ]
}
```

### 示例：Validate Document
```json
{
  "doc": "BASE64_DOCUMENT"
}
```

## 部署指南
### Docker
```bash
docker build -t affine-yjs-service .
docker run -p 3001:3001 affine-yjs-service
```

### Docker Compose
```yaml
version: "3.8"
services:
  yjs-service:
    image: affine-yjs-service:latest
    container_name: affine-yjs-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

### Java HTTP 客户端建议
```java
@Bean
public RestTemplate yjsRestTemplate() {
    PoolingHttpClientConnectionManager connectionManager =
        new PoolingHttpClientConnectionManager();
    connectionManager.setMaxTotal(100);
    connectionManager.setDefaultMaxPerRoute(20);

    CloseableHttpClient httpClient = HttpClients.custom()
        .setConnectionManager(connectionManager)
        .build();

    return new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
}
```
> ✅ 复用连接可显著降低延迟。

## 性能与可观测性
- 使用 `/api/yjs/batch/merge` 进行批处理，减少网络往返。
- 在 Java 端对热点结果做缓存：
  ```java
  @Cacheable(value = "yjs-merged", key = "#updates.hashCode()")
  public byte[] mergeUpdates(List<byte[]> updates) {
      return yjsServiceClient.mergeUpdates(updates);
  }
  ```
- `/metrics` 暴露：`yjs_merge_duration_seconds`、`yjs_merge_total`、`yjs_merge_errors_total`、`yjs_active_requests`。
- 日志使用 JSON 结构化格式，可直接接入 Loki / ELK。

## 故障排查
| 症状 | 处理 |
| --- | --- |
| 服务无法启动 | 检查端口占用：`lsof -i :3001` |
| 合并失败 | 调用 `/api/yjs/validate` 校验 update 是否损坏 |
| 性能抖动 | `docker logs -f yjs-service` 或观察 `/metrics` 延迟 |

## 开发流程
- **测试**：`npm test`
- **Lint / Format**：`npm run lint`、`npm run format`
- **代码结构**：`src/` 服务逻辑，`test/` 自动化测试，`Dockerfile` 用于构建镜像。

## 技术栈与协议
- Node.js 18+
- Express 4.x
- Yjs 13.x
- lib0
- License: MIT

## 支持
- 📧 support@affine.pro
- 🐛 <https://github.com/toeverything/affine-java-backend/issues>
- 📖 `../docs/README.md`

</details>

---

<details id="english-doc">
<summary><strong>🇺🇸 English · Click to expand / collapse</strong></summary>

![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![License](https://img.shields.io/badge/License-MIT-orange)

## Snapshot
| Item | Details |
| --- | --- |
| Service Type | Node.js (Express) microservice refactored from the AFFiNE Yjs service to serve the YUNKE backend |
| CRDT Engine | Yjs 13.6.10 + lib0, fully compatible with the upstream binary format |
| Default Port | `3001` |
| Deployment | Run on Node 18+ or via Docker / Docker Compose |
| Health & Metrics | `/health` returns 200; `/metrics` exposes Prometheus stats |

## Highlights
- **YUNKE-focused, AFFiNE-proven**: Built by refactoring the battle-tested AFFiNE Yjs service so YUNKE reuses the same stable CRDT core.
- **Perfect Compatibility**: Every doc/state vector/update is produced by the official yjs library so Java never touches fragile binary formats.
- **Binary Safety Gateway**: This service is the single entry point; hand-crafted binaries on Java are forbidden.
- **Batch Processing**: Merge/diff multiple documents in one request to cut RTTs.
- **Observability**: Prometheus metrics plus structured logs plug into any monitoring stack.
- **Cloud Native Ready**: Docker image, Compose snippet, health checks, and restart policy included.

## Architecture Guardrail
> ⚠️ **All Yjs binary operations must pass through this service.**

✅ Recommended:
```java
byte[] emptyDoc = yjsServiceClient.createEmptyDoc(docId);
byte[] merged = yjsServiceClient.mergeUpdates(updates);
```

❌ Avoid:
```java
byte[] emptyDoc = {0x00, 0x00}; // handcrafted binaries will break compatibility
```

## Feature Matrix
| Feature | Description |
| --- | --- |
| Create Empty Doc | Produce canonical empty docs so every replica shares the same baseline |
| Merge Updates | Collapse multiple updates into a single binary |
| Diff by State Vector | Deliver incremental updates based on client state vectors |
| Extract State Vector | Pull state vectors out of updates for incremental sync |
| Batch Merge | Handle multiple documents per request |
| Validate Document | Verify that binary payloads are valid Yjs data |
| Health & Metrics | `/health` and `/metrics` endpoints included |

## Quick Start
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the service**
   ```bash
   # Development (hot reload)
   npm run dev

   # Production
   npm start
   ```
   By default it listens on `http://localhost:3001`.
3. **Health check**
   ```bash
   curl http://localhost:3001/health
   ```
4. **Environment variables**
   | Key | Description |
   | --- | --- |
   | `PORT` | Defaults to `3001`; override to change the listener |
   | `NODE_ENV` | `development` / `production`; controls logging & stack traces |

## API Overview
| # | Endpoint | Verb | Description |
| - | --- | --- | --- |
| 1 | `/api/yjs/create-empty` | POST | Create a canonical empty Yjs document |
| 2 | `/api/yjs/merge` | POST | Merge multiple updates |
| 3 | `/api/yjs/diff` | POST | Compute a differential update from a state vector |
| 4 | `/api/yjs/state-vector` | POST | Extract a state vector from an update |
| 5 | `/api/yjs/batch/merge` | POST | Merge multiple documents per request |
| 6 | `/api/yjs/validate` | POST | Validate a Yjs document/update |
| 7 | `/health` | GET | Health probe |
| 8 | `/metrics` | GET | Prometheus metrics |

### Example: Create Empty
```json
{
  "docId": "optional-doc-id"
}
```
```json
{
  "success": true,
  "empty": "AAEAAcgA",
  "size": 3,
  "hexPreview": "00 01 00",
  "timestamp": "2025-10-23T10:30:00.000Z"
}
```

### Example: Merge Updates
```json
{
  "updates": [
    "AQIDBAU=",
    "BgcICQo="
  ]
}
```

### Example: Diff by State Vector
```json
{
  "updates": ["BASE64_UPDATE"],
  "stateVector": "BASE64_STATE_VECTOR"
}
```

### Example: Batch Merge
```json
{
  "documents": [
    { "docId": "doc-1", "updates": ["..."] },
    { "docId": "doc-2", "updates": ["..."] }
  ]
}
```

### Example: Validate Document
```json
{
  "doc": "BASE64_DOCUMENT"
}
```

## Deployment
### Docker
```bash
docker build -t affine-yjs-service .
docker run -p 3001:3001 affine-yjs-service
```

### Docker Compose
```yaml
version: "3.8"
services:
  yjs-service:
    image: affine-yjs-service:latest
    container_name: affine-yjs-service
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

### Java HTTP Client Recommendation
```java
@Bean
public RestTemplate yjsRestTemplate() {
    PoolingHttpClientConnectionManager connectionManager =
        new PoolingHttpClientConnectionManager();
    connectionManager.setMaxTotal(100);
    connectionManager.setDefaultMaxPerRoute(20);

    CloseableHttpClient httpClient = HttpClients.custom()
        .setConnectionManager(connectionManager)
        .build();

    return new RestTemplate(new HttpComponentsClientHttpRequestFactory(httpClient));
}
```
> ✅ Connection pooling keeps latency low.

## Performance & Observability
- Prefer `/api/yjs/batch/merge` for fewer round-trips.
- Cache hot merge results on the Java side:
  ```java
  @Cacheable(value = "yjs-merged", key = "#updates.hashCode()")
  public byte[] mergeUpdates(List<byte[]> updates) {
      return yjsServiceClient.mergeUpdates(updates);
  }
  ```
- `/metrics` exposes `yjs_merge_duration_seconds`, `yjs_merge_total`, `yjs_merge_errors_total`, `yjs_active_requests`.
- JSON structured logs integrate with Loki / ELK.

## Troubleshooting
| Symptom | Action |
| --- | --- |
| Service fails to start | Check port usage: `lsof -i :3001` |
| Merge errors | Call `/api/yjs/validate` to confirm the payload |
| Performance jitter | Inspect `docker logs -f yjs-service` or `/metrics` latency |

## Development Workflow
- **Tests**: `npm test`
- **Lint / Format**: `npm run lint`, `npm run format`
- **Structure**: `src/` for service logic, `test/` for automation, `Dockerfile` for image builds.

## Tech Stack & License
- Node.js 18+
- Express 4.x
- Yjs 13.x
- lib0
- License: MIT

## Support
- 📧 support@affine.pro
- 🐛 <https://github.com/toeverything/affine-java-backend/issues>
- 📖 `../docs/README.md`

</details>
