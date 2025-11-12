const Y = require('yjs');

/**
 * YJS CRDT处理核心类
 * 提供YJS文档的合并、差异计算、状态向量提取等功能
 */
class YjsHandler {
  /**
   * 合并多个YJS更新
   * @param {Array<string>} updates - Base64编码的更新数组
   * @returns {Object} { merged: string, size: number }
   */
  mergeUpdates(updates) {
    console.log(`🔄 [YjsHandler] 开始合并 ${updates.length} 个更新`);

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('updates必须是非空数组');
    }

    // 快速返回单个更新
    if (updates.length === 1) {
      return {
        merged: updates[0],
        size: Buffer.from(updates[0], 'base64').length
      };
    }

    try {
      // 创建新文档
      const doc = new Y.Doc();

      // 记录有效和无效的更新
      const validUpdates = [];
      const invalidUpdates = [];

      // 应用所有更新，跳过损坏的
      updates.forEach((updateBase64, index) => {
        try {
          const buffer = this.base64ToUint8Array(updateBase64);

          // 基本验证：检查数据长度
          if (!buffer || buffer.length < 2) {
            console.warn(`  ⚠️  跳过更新 ${index + 1}: 数据太短 (${buffer?.length || 0}字节)`);
            invalidUpdates.push({ index: index + 1, reason: 'too short', length: buffer?.length || 0 });
            return;
          }

          // 调试：显示前16字节的十六进制
          const hexPreview = Array.from(buffer.slice(0, Math.min(16, buffer.length)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log(`  🔍 更新 ${index + 1} 前16字节: ${hexPreview}`);

          // 尝试应用更新
          Y.applyUpdate(doc, buffer);
          validUpdates.push(index + 1);
          console.log(`  ✅ 应用更新 ${index + 1}/${updates.length} (${buffer.length}字节)`);

        } catch (error) {
          console.warn(`  ⚠️  跳过更新 ${index + 1}: ${error.message}`);
          
          // 显示失败数据的前16字节
          try {
            const buffer = this.base64ToUint8Array(updateBase64);
            const hexPreview = Array.from(buffer.slice(0, Math.min(16, buffer.length)))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(' ');
            console.warn(`  🔍 失败数据前16字节: ${hexPreview}`);
          } catch (e) {
            console.warn(`  🔍 无法解析Base64数据`);
          }
          
          invalidUpdates.push({
            index: index + 1,
            reason: error.message,
            length: updateBase64?.length || 0
          });
        }
      });

      // 检查是否有有效更新
      if (validUpdates.length === 0) {
        const errorMsg = `所有${updates.length}个更新都无效，无法合并`;
        console.error(`❌ [YjsHandler] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // 生成合并后的状态
      const merged = Y.encodeStateAsUpdate(doc);
      const mergedBase64 = this.uint8ArrayToBase64(merged);

      // 构建结果
      const result = {
        merged: mergedBase64,
        size: merged.length,
        originalCount: updates.length,
        validCount: validUpdates.length,
        invalidCount: invalidUpdates.length
      };

      // 如果有无效更新，添加到结果中
      if (invalidUpdates.length > 0) {
        result.skippedUpdates = invalidUpdates;
        console.log(`⚠️  [YjsHandler] 合并完成(含警告): ${validUpdates.length}/${updates.length}个有效 → ${merged.length}字节`);
      } else {
        console.log(`✅ [YjsHandler] 合并完成: ${updates.length}个 → ${merged.length}字节`);
      }

      return result;

    } catch (error) {
      console.error('❌ [YjsHandler] 合并失败:', error);
      throw error;
    }
  }

  /**
   * 计算差异更新
   * @param {string} update - 完整更新(Base64)
   * @param {string} stateVector - 客户端状态向量(Base64，可选)
   * @returns {Object} { diff: string, size: number }
   */
  diffUpdate(update, stateVector) {
    console.log('🔍 [YjsHandler] 计算差异更新');

    try {
      const updateBuffer = this.base64ToUint8Array(update);

      // 如果没有状态向量，返回完整更新
      if (!stateVector) {
        console.log('  → 无状态向量，返回完整更新');
        return {
          diff: update,
          size: updateBuffer.length
        };
      }

      const stateBuffer = this.base64ToUint8Array(stateVector);

      // 计算差异
      const diff = Y.diffUpdate(updateBuffer, stateBuffer);
      const diffBase64 = this.uint8ArrayToBase64(diff);

      console.log(`✅ [YjsHandler] 差异计算完成: ${diff.length}字节`);

      return {
        diff: diffBase64,
        size: diff.length
      };

    } catch (error) {
      console.error('❌ [YjsHandler] 差异计算失败:', error);
      // 失败时返回完整更新
      return {
        diff: update,
        size: Buffer.from(update, 'base64').length,
        error: error.message
      };
    }
  }

  /**
   * 提取状态向量
   * @param {string} update - 更新数据(Base64)
   * @returns {Object} { stateVector: string, size: number }
   */
  encodeStateVector(update) {
    console.log('📊 [YjsHandler] 提取状态向量');

    try {
      const doc = new Y.Doc();
      const buffer = this.base64ToUint8Array(update);
      Y.applyUpdate(doc, buffer);

      const stateVector = Y.encodeStateVector(doc);
      const stateVectorBase64 = this.uint8ArrayToBase64(stateVector);

      console.log(`✅ [YjsHandler] 状态向量提取完成: ${stateVector.length}字节`);

      return {
        stateVector: stateVectorBase64,
        size: stateVector.length
      };

    } catch (error) {
      console.error('❌ [YjsHandler] 状态向量提取失败:', error);
      throw error;
    }
  }

  /**
   * 应用更新到现有文档
   * @param {string} currentDoc - 当前文档(Base64)
   * @param {string} update - 新更新(Base64)
   * @returns {Object} { result: string, size: number }
   */
  applyUpdate(currentDoc, update) {
    console.log('🔄 [YjsHandler] 应用更新到文档');

    try {
      const doc = new Y.Doc();

      // 应用当前文档
      if (currentDoc) {
        const currentBuffer = this.base64ToUint8Array(currentDoc);
        Y.applyUpdate(doc, currentBuffer);
      }

      // 应用新更新
      const updateBuffer = this.base64ToUint8Array(update);
      Y.applyUpdate(doc, updateBuffer);

      // 生成结果
      const result = Y.encodeStateAsUpdate(doc);
      const resultBase64 = this.uint8ArrayToBase64(result);

      console.log(`✅ [YjsHandler] 更新应用完成: ${result.length}字节`);

      return {
        result: resultBase64,
        size: result.length
      };

    } catch (error) {
      console.error('❌ [YjsHandler] 应用更新失败:', error);
      throw error;
    }
  }

  /**
   * 批量合并（支持多个文档）
   * @param {Array<{docId: string, updates: Array<string>}>} batches
   * @returns {Array<{docId: string, merged: string, size: number}>}
   */
  batchMerge(batches) {
    console.log(`📦 [YjsHandler] 批量合并 ${batches.length} 个文档`);

    const results = batches.map(({ docId, updates }) => {
      try {
        const result = this.mergeUpdates(updates);
        return {
          docId,
          success: true,
          merged: result.merged,
          size: result.size
        };
      } catch (error) {
        console.error(`❌ 文档 ${docId} 合并失败:`, error.message);
        return {
          docId,
          success: false,
          error: error.message
        };
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ [YjsHandler] 批量合并完成: ${successCount}/${batches.length} 成功`);

    return results;
  }

  /**
   * 创建空的YJS文档
   * @param {string} docId - 文档ID（可选，用于日志）
   * @returns {Object} { empty: string, size: number }
   */
  createEmpty(docId = null) {
    const logPrefix = docId ? `[docId: ${docId}]` : '';
    console.log(`📄 [YjsHandler] 创建空文档 ${logPrefix}`);
    
    try {
      // 创建新的空 Y.Doc
      const doc = new Y.Doc();
      
      // 编码为 Y.js 更新格式（这是标准的空文档表示）
      const emptyState = Y.encodeStateAsUpdate(doc);
      const emptyBase64 = this.uint8ArrayToBase64(emptyState);
      
      // 显示二进制内容的十六进制预览
      const hexPreview = Array.from(emptyState.slice(0, Math.min(16, emptyState.length)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      
      console.log(`  🔍 空文档二进制: ${hexPreview}${emptyState.length > 16 ? '...' : ''}`);
      console.log(`✅ [YjsHandler] 空文档创建完成 ${logPrefix}: ${emptyState.length}字节`);
      
      return {
        empty: emptyBase64,
        size: emptyState.length,
        hexPreview: hexPreview
      };
      
    } catch (error) {
      console.error(`❌ [YjsHandler] 空文档创建失败 ${logPrefix}:`, error);
      throw error;
    }
  }

  /**
   * 验证YJS文档格式
   * @param {string} docBase64 - 文档数据(Base64)
   * @returns {Object} { valid: boolean, info: object }
   */
  validateDoc(docBase64) {
    try {
      const doc = new Y.Doc();
      const buffer = this.base64ToUint8Array(docBase64);
      Y.applyUpdate(doc, buffer);

      return {
        valid: true,
        size: buffer.length,
        clientID: doc.clientID
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * Base64 → Uint8Array
   */
  base64ToUint8Array(base64) {
    if (base64 instanceof Uint8Array) {
      return base64;
    }
    const binary = Buffer.from(base64, 'base64');
    return new Uint8Array(binary);
  }

  /**
   * Uint8Array → Base64
   */
  uint8ArrayToBase64(uint8Array) {
    return Buffer.from(uint8Array).toString('base64');
  }

  /**
   * 获取YJS版本信息
   */
  getVersion() {
    const yjsVersion = require('yjs/package.json').version;
    const lib0Version = require('lib0/package.json').version;
    return {
      yjs: yjsVersion,
      lib0: lib0Version
    };
  }
}

module.exports = YjsHandler;
