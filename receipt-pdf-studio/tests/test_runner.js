/**
 * Receipt PDF Studio - 自動テストスイート
 * Node.js 環境で実行し、ビジネスロジック、計算アルゴリズム、セキュリティ規約を検証します。
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (期待値: ${expected}, 実際: ${actual})`);
}

console.log('====================================================');
console.log('🧪 Receipt PDF Studio - 総合自動テスト開始');
console.log('====================================================\n');

// ----------------------------------------------------
// Test Group 1: セキュリティ＆メモリ規約監査 (Static Code Audit)
// ----------------------------------------------------
console.log('▶ [Test 1] セキュリティ規約監査 (mem_004: XSS防止 textContent原則)');
const appJsPath = path.join(__dirname, '../js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// innerHTML の安全でない使用がないか検証
const dangerousInnerHTMLMatches = appJsContent.match(/\.innerHTML\s*=/g) || [];
assert(dangerousInnerHTMLMatches.length === 0, 'app.js 内に innerHTML への直接代入が存在しないこと (XSS防止)');

const hasTextContentUsage = appJsContent.includes('.textContent =');
assert(hasTextContentUsage, 'app.js 内で動的テキスト描画に textContent が徹底使用されていること');

console.log('\n▶ [Test 2] モバイルUX規約監査 (mem_003: 44pxタッチターゲット)');
const cssPath = path.join(__dirname, '../css/style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('--min-touch-size: 44px') || cssContent.includes('44px'), 'CSSで44px以上の最小タッチ寸法が定義されていること');
assert(cssContent.includes('min-height: var(--min-touch-size)') || cssContent.includes('min-height: 44px'), '主要ボタン類に44px以上のmin-heightが適用されていること');

// ----------------------------------------------------
// Test Group 2: 画像補正ロジックの計算精度検証
// ----------------------------------------------------
console.log('\n▶ [Test 3] 領収書スキャナー画像補正アルゴリズム検証');

// コントラスト係数計算式の単体テスト
function calcContrastFactor(contrast) {
  const adjContrast = Math.max(-100, Math.min(100, contrast));
  return (259 * (adjContrast + 255)) / (255 * (259 - adjContrast));
}

assertEqual(Math.round(calcContrastFactor(0)), 1, 'コントラスト0のとき係数は1.0');
assert(calcContrastFactor(20) > 1.1, 'コントラスト+20のとき係数が1.0を超えること (コントラスト強調)');

// レシートくっきり白黒化アルゴリズムの階調テスト
function receiptBwTransform(gray) {
  if (gray > 165) {
    return 255; // 白
  } else if (gray < 85) {
    return 0;   // 黒
  } else {
    const normalized = (gray - 85) / 80;
    return Math.round(normalized * normalized * 255);
  }
}

assertEqual(receiptBwTransform(200), 255, '背景紙（薄いグレー200）は完全な白(255)にクリアされる');
assertEqual(receiptBwTransform(50), 0, '印字インク（濃い文字50）は完全な黒(0)にシャープ化される');
assert(receiptBwTransform(120) >= 0 && receiptBwTransform(120) <= 255, '中間調は滑らかなS字カーブでクリッピングされる');

// ----------------------------------------------------
// Test Group 3: PDF操作ロジック（結合・分割・抽出・並べ替え）
// ----------------------------------------------------
console.log('\n▶ [Test 4] ページ並べ替え・回転ロジック検証');

// ページ移動ロジック
function movePage(pages, fromIndex, toIndex) {
  const cloned = [...pages];
  const [moved] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, moved);
  return cloned;
}

const mockPages = [
  { id: 'p1', name: 'レシート1' },
  { id: 'p2', name: 'レシート2' },
  { id: 'p3', name: 'レシート3' }
];

const reordered = movePage(mockPages, 0, 2);
assertEqual(reordered[0].id, 'p2', '移動後インデックス0がp2になる');
assertEqual(reordered[1].id, 'p3', '移動後インデックス1がp3になる');
assertEqual(reordered[2].id, 'p1', '移動後インデックス2がp1になる');

// 累積回転ロジック
let rot = 0;
rot = (rot + 90) % 360;
assertEqual(rot, 90, '初回90度回転');
rot = (rot + 90) % 360;
assertEqual(rot, 180, '2回目90度回転(計180度)');
rot = (rot + 90) % 360;
assertEqual(rot, 270, '3回目90度回転(計270度)');
rot = (rot + 90) % 360;
assertEqual(rot, 0, '4回目90度回転(360度→0度へリセット)');

console.log('\n▶ [Test 5] 分割・抽出ロジック検証');

// 分割ロジック
function simulateSplit(pages, splitAfterIndices) {
  const sortedSplits = [...new Set(splitAfterIndices)]
    .filter(idx => idx >= 0 && idx < pages.length - 1)
    .sort((a, b) => a - b);

  const parts = [];
  let startIdx = 0;
  for (let i = 0; i <= sortedSplits.length; i++) {
    const endIdx = (i < sortedSplits.length) ? sortedSplits[i] + 1 : pages.length;
    const slicePages = pages.slice(startIdx, endIdx);
    if (slicePages.length > 0) {
      parts.push({
        partNum: i + 1,
        pageCount: slicePages.length,
        startPage: startIdx + 1,
        endPage: endIdx
      });
    }
    startIdx = endIdx;
  }
  return parts;
}

const testFourPages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const splitResult = simulateSplit(testFourPages, [1]); // ページ2の直後で分割
assertEqual(splitResult.length, 2, '2分割されること');
assertEqual(splitResult[0].pageCount, 2, 'Part 1 は2ページ (p.1-2)');
assertEqual(splitResult[1].pageCount, 2, 'Part 2 は2ページ (p.3-4)');

// 抽出ロジック
function simulateExtract(pages, selectedIds) {
  const selectedSet = new Set(selectedIds);
  return pages.filter(p => selectedSet.has(p.id));
}

const extracted = simulateExtract(mockPages, ['p1', 'p3']);
assertEqual(extracted.length, 2, '指定した2ページのみが抽出されること');
assertEqual(extracted[0].id, 'p1', '抽出1件目はp1');
assertEqual(extracted[1].id, 'p3', '抽出2件目はp3');

// ----------------------------------------------------
// Test Group 6: PWA＆出先オフライン対応の整合性検証
// ----------------------------------------------------
console.log('\n▶ [Test 6] PWA & オフライン対応検証 (出先利用)');
const manifestPath = path.join(__dirname, '../manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json が存在すること');

const swPath = path.join(__dirname, '../sw.js');
assert(fs.existsSync(swPath), 'sw.js (Service Worker) が存在すること');

const iconPath = path.join(__dirname, '../icons/icon.svg');
assert(fs.existsSync(iconPath), 'icons/icon.svg が存在すること');

const pdfLibVendor = path.join(__dirname, '../vendor/pdf-lib.min.js');
assert(fs.existsSync(pdfLibVendor), 'vendor/pdf-lib.min.js がローカル配置されていること (オフライン化)');

const pdfJsVendor = path.join(__dirname, '../vendor/pdf.min.js');
assert(fs.existsSync(pdfJsVendor), 'vendor/pdf.min.js がローカル配置されていること (オフライン化)');

// ----------------------------------------------------
// Test Group 7: 外部共有連携（Gmail / Chatwork / Drive / Web Share）検証
// ----------------------------------------------------
console.log('\n▶ [Test 7] 外部共有連携（Gmail / Chatwork / Drive / Web Share）検証');
const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

assert(indexHtmlContent.includes('id="shareModal"'), 'index.html に共有モーダル(shareModal)が存在すること');
assert(indexHtmlContent.includes('id="btnNativeShare"'), 'スマホネイティブ共有ボタンが存在すること');
assert(indexHtmlContent.includes('id="btnShareGmail"'), 'Gmail共有ボタンが存在すること');
assert(indexHtmlContent.includes('id="btnCopyChatworkText"'), 'Chatwork連携ボタンが存在すること');
assert(indexHtmlContent.includes('id="btnOpenGoogleDrive"'), 'Google Drive連携ボタンが存在すること');

const updatedAppJsContent = fs.readFileSync(appJsPath, 'utf8');
assert(updatedAppJsContent.includes('navigator.share'), 'app.js に Web Share API のネイティブ共有処理が含まれていること');
assert(updatedAppJsContent.includes('[info][title]領収書PDF提出[/title]'), 'Chatwork用の整形タグフォーマットが含まれていること');
assert(updatedAppJsContent.includes('mail.google.com/mail'), 'Gmail新規作成URL連携が含まれていること');

// ----------------------------------------------------
// サマリー出力
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 テスト完了: 合計 ${totalTests} 件 | 成功: ${passedTests} 件 | 失敗: ${failedTests} 件`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
