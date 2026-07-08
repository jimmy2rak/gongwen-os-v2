import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

const testHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
ol, ul { list-style: none; margin: 0; padding: 0; }
li { margin: 0; padding: 0; }

.doc-mode-simple .document-editor .ProseMirror ul {
  list-style-type: disc !important;
  list-style-position: inside !important;
  padding-left: 2em !important;
  margin: 0 !important;
  font-size: 16pt !important;
}
.doc-mode-simple .document-editor .ProseMirror ol {
  list-style-type: decimal !important;
  list-style-position: inside !important;
  padding-left: 2em !important;
  margin: 0 !important;
  font-size: 16pt !important;
}
.doc-mode-simple .document-editor .ProseMirror li::marker {
  font-family: "Times New Roman", serif !important;
  font-size: 16pt !important;
}
.doc-mode-simple .document-editor .ProseMirror li {
  font-family: "Times New Roman", "仿宋_GB2312", "仿宋", "FangSong", serif !important;
  font-size: 16pt !important;
  line-height: 28pt !important;
  margin: 0 !important;
}
.doc-mode-simple .document-editor .ProseMirror li p {
  text-indent: 0;
  margin: 0;
}
</style>
</head>
<body>
<div class="doc-mode-simple">
  <div class="document-editor">
    <div class="ProseMirror">
      <h1>列表测试</h1>
      <p>普通段落文字 ABC 123。</p>
      <p>无序列表：</p>
      <ul>
        <li><p>第一项通知内容ABC123</p></li>
        <li><p>第二项通知内容这里是多行文字测试验证第二行是否对齐到文字起始位置</p></li>
      </ul>
      <p>有序列表：</p>
      <ol>
        <li><p>编号第一项通知内容</p></li>
        <li><p>编号第二项这里是多行文字测试验证第二行是否对齐到文字起始位置</p></li>
      </ol>
    </div>
  </div>
</div>
</body>
</html>
`;

await page.setContent(testHtml);

console.log('=== 无序列表 <ul> 计算样式 ===');
const ul = await page.$('.ProseMirror ul');
if (ul) {
  const s = await ul.evaluate(el => {
    const style = getComputedStyle(el);
    return { listStyleType: style.listStyleType, listStylePosition: style.listStylePosition, paddingLeft: style.paddingLeft };
  });
  console.log(s);
}

console.log('\n=== 有序列表 <ol> 计算样式 ===');
const ol = await page.$('.ProseMirror ol');
if (ol) {
  const s = await ol.evaluate(el => {
    const style = getComputedStyle(el);
    return { listStyleType: style.listStyleType, listStylePosition: style.listStylePosition, paddingLeft: style.paddingLeft };
  });
  console.log(s);
}

console.log('\n=== <li> 计算样式 ===');
const li = await page.$('.ProseMirror li');
if (li) {
  const s = await li.evaluate(el => {
    const style = getComputedStyle(el);
    return { fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, marginTop: style.marginTop };
  });
  console.log(s);
}

console.log('\n=== 截图 ===');
await page.screenshot({ path: '/tmp/list-test-result.png', fullPage: true });
console.log('截图保存在: /tmp/list-test-result.png');

console.log('\n=== ::marker 样式检查 ===');
const markerInfo = await page.evaluate(() => {
  const li = document.querySelector('.ProseMirror li');
  if (!li) return 'no li found';
  const afterStyle = window.getComputedStyle(li, '::marker');
  return { fontFamily: afterStyle.fontFamily, fontSize: afterStyle.fontSize, content: afterStyle.content };
});
console.log(markerInfo);

await browser.close();
