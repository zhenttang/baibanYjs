const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const YjsHandler = require('./yjs-handler');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// 中间件
app.use(cors());

const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '100mb';
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ limit: REQUEST_BODY_LIMIT, extended: true }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // 记录请求开始
  if (req.path.startsWith('/api/yjs/')) {
    console.log(`\n⏱️  [${timestamp}] ${req.method} ${req.path} - 开始处理`);
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/yjs/')) {
      console.log(`⏱️  [${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)\n`);
    } else {
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 创建YJS处理器实例
const yjsHandler = new YjsHandler();

// ==================== 路由 ====================

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  const version = yjsHandler.getVersion();
  res.json({
    status: 'ok',
    service: 'affine-yjs-service',
    uptime: process.uptime(),
    version,
    timestamp: new Date().toISOString()
  });
});

/**
 * 获取服务信息
 */
app.get('/info', (req, res) => {
  const version = yjsHandler.getVersion();
  res.json({
    name: 'AFFiNE YJS CRDT Service',
    description: '为AFFiNE Java后端提供YJS处理能力',
    version: '1.0.0',
    yjs: version,
    endpoints: {
      merge: 'POST /api/yjs/merge',
      diff: 'POST /api/yjs/diff',
      stateVector: 'POST /api/yjs/state-vector',
      apply: 'POST /api/yjs/apply',
      batchMerge: 'POST /api/yjs/batch-merge',
      validate: 'POST /api/yjs/validate',
      createEmpty: 'POST /api/yjs/create-empty'
    }
  });
});

/**
 * 合并多个YJS更新
 * POST /api/yjs/merge
 * Body: { updates: ["base64_update1", "base64_update2", ...], docId: "xxx" (可选) }
 */
app.post('/api/yjs/merge', (req, res) => {
  try {
    const { updates, docId } = req.body;

    console.log(`📥 [API/merge] 收到合并请求: {docId: '${docId || 'unknown'}', updatesCount: ${updates?.length || 0}}`);

    if (!Array.isArray(updates) || updates.length === 0) {
      console.warn('⚠️  [API/merge] 参数错误: updates必须是非空数组');
      return res.status(400).json({
        success: false,
        error: 'updates必须是非空数组'
      });
    }

    // 记录每个更新的大小
    const updateSizes = updates.map((u, i) => {
      const size = Buffer.from(u, 'base64').length;
      console.log(`  📦 更新 ${i + 1}/${updates.length}: ${size}字节`);
      return size;
    });

    const result = yjsHandler.mergeUpdates(updates);

    console.log(`✅ [API/merge] 合并成功: {docId: '${docId || 'unknown'}', resultSize: ${result.size}字节, originalCount: ${result.originalCount}}`);

    res.json({
      success: true,
      merged: result.merged,
      size: result.size,
      originalCount: result.originalCount
    });

  } catch (error) {
    console.error('❌ [API/merge] 合并失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 计算差异更新
 * POST /api/yjs/diff
 * Body: { update: "base64_update", stateVector: "base64_state_vector" }
 */
app.post('/api/yjs/diff', (req, res) => {
  try {
    const { update, stateVector } = req.body;

    if (!update) {
      return res.status(400).json({
        success: false,
        error: 'update参数必需'
      });
    }

    const result = yjsHandler.diffUpdate(update, stateVector);

    res.json({
      success: true,
      diff: result.diff,
      size: result.size,
      error: result.error
    });

  } catch (error) {
    console.error('❌ [API] 差异计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 提取状态向量
 * POST /api/yjs/state-vector
 * Body: { update: "base64_update" }
 */
app.post('/api/yjs/state-vector', (req, res) => {
  try {
    const { update } = req.body;

    if (!update) {
      return res.status(400).json({
        success: false,
        error: 'update参数必需'
      });
    }

    const result = yjsHandler.encodeStateVector(update);

    res.json({
      success: true,
      stateVector: result.stateVector,
      size: result.size
    });

  } catch (error) {
    console.error('❌ [API] 状态向量提取失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 应用更新到文档
 * POST /api/yjs/apply
 * Body: { currentDoc: "base64_doc", update: "base64_update", docId: "xxx" (可选) }
 */
app.post('/api/yjs/apply', (req, res) => {
  try {
    const { currentDoc, update, docId } = req.body;

    const currentDocSize = currentDoc ? Buffer.from(currentDoc, 'base64').length : 0;
    const updateSize = update ? Buffer.from(update, 'base64').length : 0;

    console.log(`📥 [API/apply] 收到应用更新请求: {docId: '${docId || 'unknown'}', currentDocSize: ${currentDocSize}字节, updateSize: ${updateSize}字节}`);

    if (!update) {
      console.warn('⚠️  [API/apply] 参数错误: update参数必需');
      return res.status(400).json({
        success: false,
        error: 'update参数必需'
      });
    }

    const result = yjsHandler.applyUpdate(currentDoc, update);

    console.log(`✅ [API/apply] 更新应用成功: {docId: '${docId || 'unknown'}', resultSize: ${result.size}字节}`);

    res.json({
      success: true,
      result: result.result,
      size: result.size
    });

  } catch (error) {
    console.error(`❌ [API/apply] 应用更新失败: {docId: '${docId || 'unknown'}'}`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量合并（多个文档）
 * POST /api/yjs/batch-merge
 * Body: { batches: [{ docId: "doc1", updates: [...] }, ...] }
 */
app.post('/api/yjs/batch-merge', (req, res) => {
  try {
    const { batches } = req.body;

    console.log(`📥 [API/batch-merge] 收到批量合并请求: {batchesCount: ${batches?.length || 0}}`);

    if (!Array.isArray(batches) || batches.length === 0) {
      console.warn('⚠️  [API/batch-merge] 参数错误: batches必须是非空数组');
      return res.status(400).json({
        success: false,
        error: 'batches必须是非空数组'
      });
    }

    // 记录每个批次的信息
    batches.forEach((batch, i) => {
      console.log(`  📦 批次 ${i + 1}: {docId: '${batch.docId}', updatesCount: ${batch.updates?.length || 0}}`);
    });

    const results = yjsHandler.batchMerge(batches);

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [API/batch-merge] 批量合并完成: ${successCount}/${batches.length} 成功`);

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ [API/batch-merge] 批量合并失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建空的YJS文档
 * POST /api/yjs/create-empty
 * Body: { docId: "xxx" (可选，用于日志) }
 */
app.post('/api/yjs/create-empty', (req, res) => {
  try {
    const { docId } = req.body;

    console.log(`📥 [API/create-empty] 收到创建空文档请求: {docId: '${docId || 'unknown'}'}`);

    const result = yjsHandler.createEmpty(docId);

    console.log(`✅ [API/create-empty] 空文档创建成功: {docId: '${docId || 'unknown'}', size: ${result.size}字节}`);

    res.json({
      success: true,
      empty: result.empty,
      size: result.size,
      hexPreview: result.hexPreview,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [API/create-empty] 创建失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 验证YJS文档
 * POST /api/yjs/validate
 * Body: { doc: "base64_doc" }
 */
app.post('/api/yjs/validate', (req, res) => {
  try {
    const { doc } = req.body;

    if (!doc) {
      return res.status(400).json({
        success: false,
        error: 'doc参数必需'
      });
    }

    const result = yjsHandler.validateDoc(doc);

    res.json({
      success: result.valid,
      ...result
    });

  } catch (error) {
    console.error('❌ [API] 验证失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('❌ [Server Error]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('🚀  AFFiNE YJS CRDT Service 已启动');
  console.log('🚀 ========================================');
  console.log(`🌐  服务地址: http://${HOST}:${PORT}`);
  console.log(`📊  健康检查: http://${HOST}:${PORT}/health`);
  console.log(`ℹ️   服务信息: http://${HOST}:${PORT}/info`);
  console.log('🚀 ========================================');
  console.log('');
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('📛 收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});
