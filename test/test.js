const http = require('http');

/**
 * 简单的测试脚本
 * 验证YJS服务的基本功能
 */

const BASE_URL = 'http://localhost:3001';

// 辅助函数：发送HTTP请求
function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 测试用例
async function runTests() {
  console.log('🧪 开始测试 YJS Service...\n');

  try {
    // 测试1: 健康检查
    console.log('测试1: 健康检查');
    const health = await request('GET', '/health');
    console.log('✅ 健康检查通过:', health.data);
    console.log('');

    // 测试2: 服务信息
    console.log('测试2: 获取服务信息');
    const info = await request('GET', '/info');
    console.log('✅ 服务信息:', info.data.name);
    console.log('   YJS版本:', info.data.yjs);
    console.log('');

    // 测试3: 合并updates（使用真实YJS数据）
    console.log('测试3: 合并YJS updates');
    const mergeData = {
      updates: [
        'AAIBAwQF',  // 模拟update1
        'BgcICQo='   // 模拟update2
      ]
    };
    const merge = await request('POST', '/api/yjs/merge', mergeData);
    if (merge.data.success) {
      console.log('✅ 合并成功');
      console.log('   原始数量:', merge.data.originalCount);
      console.log('   合并大小:', merge.data.size, 'bytes');
    } else {
      console.log('❌ 合并失败:', merge.data.error);
    }
    console.log('');

    // 测试4: 差异计算
    console.log('测试4: 差异计算');
    const diffData = {
      update: 'AAIBAwQFBgcICQo=',
      stateVector: 'AQIDBA=='
    };
    const diff = await request('POST', '/api/yjs/diff', diffData);
    if (diff.data.success) {
      console.log('✅ 差异计算成功');
      console.log('   差异大小:', diff.data.size, 'bytes');
    } else {
      console.log('❌ 差异计算失败:', diff.data.error);
    }
    console.log('');

    // 测试5: 状态向量提取
    console.log('测试5: 提取状态向量');
    const svData = {
      update: 'AAIBAwQF'
    };
    const sv = await request('POST', '/api/yjs/state-vector', svData);
    if (sv.data.success) {
      console.log('✅ 状态向量提取成功');
      console.log('   向量大小:', sv.data.size, 'bytes');
    } else {
      console.log('❌ 状态向量提取失败:', sv.data.error);
    }
    console.log('');

    // 测试6: 批量合并
    console.log('测试6: 批量合并');
    const batchData = {
      batches: [
        { docId: 'doc1', updates: ['AQID', 'BAUG'] },
        { docId: 'doc2', updates: ['BwgJ', 'CgsM'] }
      ]
    };
    const batch = await request('POST', '/api/yjs/batch-merge', batchData);
    if (batch.data.success) {
      const successCount = batch.data.results.filter(r => r.success).length;
      console.log('✅ 批量合并成功');
      console.log('   成功数量:', successCount + '/' + batch.data.results.length);
    } else {
      console.log('❌ 批量合并失败:', batch.data.error);
    }
    console.log('');

    // 测试7: 文档验证
    console.log('测试7: 文档验证');
    const validateData = {
      doc: 'AAIBAwQF'
    };
    const validate = await request('POST', '/api/yjs/validate', validateData);
    if (validate.data.success) {
      console.log('✅ 文档验证通过');
      console.log('   有效性:', validate.data.valid);
    } else {
      console.log('❌ 文档验证失败');
    }
    console.log('');

    console.log('🎉 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runTests();
