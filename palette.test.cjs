/* 验证配色数量、色库约束，以及新增算法的关键行为。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const api = new Function(fs.readFileSync(path.join(__dirname, 'palette.js'), 'utf8') + ';return {describeColor,distance,makeScheme,styles,schemeRoles,contrast};')();
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'colors.json'), 'utf8')).map(api.describeColor);
const added = api.styles.slice(3);
let checked = 0;

function validate(palette, count, style) {
  assert.equal(palette.length, count, '配色数量必须符合选择');
  assert.equal(new Set(palette.map(c=>c.hex.toLowerCase())).size, count, '方案内不能有重复色值');
  assert.ok(palette.every(c=>catalog.includes(c)), '所有颜色必须来自色库');
  assert.equal(api.schemeRoles(count, style).length, count, '角色标签数量必须匹配');
  checked++;
}

for (const style of added.filter(s=>!s.algorithm)) {
  for (const base of catalog) {
    for (let count = 2; count <= 10; count++) {
      const palette = api.makeScheme(base,style,catalog,checked%4,count);
      validate(palette,count,style);
      assert.equal(palette[0],base,'和谐配色必须保留主色');
      if (count >= 5) assert.ok(api.contrast(palette[3],palette[4]) >= 4.5,'文字与背景必须有足够对比度');
    }
  }
}

const farthest = added.find(s=>s.algorithm === 'farthest');
for (const base of catalog.filter((_,i)=>i%25 === 0)) {
  const palette = api.makeScheme(base,farthest,catalog,0,10);
  for (let count = 2; count <= 10; count++) {
    const result = api.makeScheme(base,farthest,catalog,3,count);
    validate(result,count,farthest);
    assert.deepEqual(result,palette.slice(0,count),'最大色差应保留主色，且不受换组版本影响');
  }
  for (let i=1; i<palette.length; i++) {
    const previous = palette.slice(0,i);
    const minimum = color=>Math.min(...previous.map(c=>api.distance(c,color)));
    const best = Math.max(...catalog.filter(c=>!previous.some(p=>p.hex===c.hex)).map(minimum));
    assert.ok(Math.abs(minimum(palette[i])-best)<1e-10,'每一步必须最大化与已选颜色的最小距离');
  }
}

const cluster = added.find(s=>s.algorithm === 'cluster');
for (let count=2; count<=10; count++) {
  for (let variant=0; variant<4; variant++) {
    const palette = api.makeScheme(catalog[0],cluster,catalog,variant,count);
    validate(palette,count,cluster);
    assert.deepEqual(palette,api.makeScheme(catalog[200],cluster,catalog,variant,count),'聚类必须可复现，且不受主色影响');
  }
}

const equalHue = added.find(s=>s.algorithm === 'equal-hue');
for (const base of catalog) {
  for (let count=2; count<=10; count++) {
    const palette = api.makeScheme(base,equalHue,catalog,checked%4,count);
    validate(palette,count,equalHue);
    assert.equal(palette[0],base,'色相等分必须保留主色');
  }
}
// 构造具有精确等分方向的色库，验证角度与跨零度处理，而不只验证数量。
for (let count=2; count<=10; count++) {
  const start = 350*Math.PI/180;
  const exact = Array.from({length:count},(_,i)=>{
    const h = start + 2*Math.PI*i/count;
    return {hex:'#'+(i+1).toString(16).padStart(6,'0'),name:`测试色${i}`,L:0.65,C:0.12,h:Math.atan2(Math.sin(h),Math.cos(h)),a:0.12*Math.cos(h),b:0.12*Math.sin(h)};
  });
  const result = api.makeScheme(exact[0],equalHue,[...exact].reverse(),0,count);
  assert.deepEqual(result,exact,'存在精确等分色时，应按主色起始角依次选出');
  assert.deepEqual(result,api.makeScheme(exact[0],equalHue,exact,0,count),'无距离并列时，结果不应依赖色库顺序');
}
const gray = api.describeColor({name:'测试灰',hex:'#808080'});
const reference = {...gray,h:2};
assert.deepEqual(api.makeScheme(gray,equalHue,catalog,0,5).slice(1),api.makeScheme(reference,equalHue,catalog,0,5).slice(1),'近中性色应使用固定参考方向');

for (const style of added) {
  for (const count of [1,11,2.5,NaN]) assert.throws(()=>api.makeScheme(catalog[0],style,catalog,0,count),/颜色数量/,'非法数量必须被拒绝');
}
const page = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for (const script of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(script[1]);
console.log(`检查通过：${checked} 组配色，新增算法约束及页面脚本语法均正常。`);
